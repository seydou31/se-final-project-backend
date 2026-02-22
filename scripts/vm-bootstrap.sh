#!/bin/bash
# vm-bootstrap.sh — One-time setup for a fresh GCP VM running BaeQuest.
#
# Run as the badiakaseydou user after first SSH login:
#   bash <(curl -sL https://raw.githubusercontent.com/seydou31/se-final-project-backend/main/scripts/vm-bootstrap.sh)
#
# Prerequisites before running:
#   - VM created with 25 GB disk, ports 22/80/443 open in GCP firewall
#   - Elastic/static IP assigned to the VM
#   - DNS: baequests.com, www.baequests.com, api.baequests.com → VM IP
#   - GC_SERVER_HOST secret in both GitHub repos = VM IP
#
# What this does NOT do (CI/CD handles it automatically on push):
#   - Start backend container  (triggered by push to se-final-project-backend)
#   - Start frontend container (triggered by push to se-final-project)
#   - Write .env file          (CI writes it from BACKEND_ENV_FILE secret)

set -eo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
CERTBOT_EMAIL="badiakaseydou@gmail.com"
USER_HOME="/home/badiakaseydou"
# ─────────────────────────────────────────────────────────────────────────────

echo "════════════════════════════════════════"
echo " BaeQuest VM Bootstrap"
echo "════════════════════════════════════════"

# ── [1/7] System packages ────────────────────────────────────────────────────
echo ""
echo "=== [1/7] Installing system packages ==="
sudo apt-get update -y
sudo apt-get install -y \
    nginx \
    cron \
    psmisc \
    curl \
    unzip \
    certbot \
    python3-certbot-nginx

# ── [2/7] Docker ─────────────────────────────────────────────────────────────
echo ""
echo "=== [2/7] Installing Docker ==="
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker "$USER"
    echo "✓ Docker installed. Group membership takes effect on next login."
else
    echo "✓ Docker already installed."
fi

# ── [3/7] AWS CLI v2 ─────────────────────────────────────────────────────────
echo ""
echo "=== [3/7] Installing AWS CLI v2 ==="
if ! command -v aws &>/dev/null; then
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
    unzip -q /tmp/awscliv2.zip -d /tmp/
    sudo /tmp/aws/install
    rm -rf /tmp/awscliv2.zip /tmp/aws
    echo "✓ AWS CLI installed: $(aws --version)"
else
    echo "✓ AWS CLI already installed: $(aws --version)"
fi

# ── [4/7] mongodump ──────────────────────────────────────────────────────────
echo ""
echo "=== [4/7] Installing MongoDB Database Tools (mongodump) ==="
if ! command -v mongodump &>/dev/null; then
    # Add MongoDB repo for the current Ubuntu release
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
        | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-archive-keyring.gpg
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-archive-keyring.gpg ] \
https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" \
        | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y mongodb-database-tools
    echo "✓ mongodump installed: $(mongodump --version)"
else
    echo "✓ mongodump already installed."
fi

# ── [5/7] nginx + SSL ────────────────────────────────────────────────────────
echo ""
echo "=== [5/7] Configuring nginx ==="

# Write HTTP-only config first; certbot will add the SSL blocks below.
sudo tee /etc/nginx/sites-available/baequests.com > /dev/null << 'NGINX_CONF'
# Backend API
server {
    server_name api.baequests.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 80;
}

# Frontend
server {
    server_name baequests.com www.baequests.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    listen 80;
}
NGINX_CONF

sudo ln -sf /etc/nginx/sites-available/baequests.com /etc/nginx/sites-enabled/baequests.com
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
echo "✓ nginx configured and running."

echo ""
echo "=== [5/7 cont.] Obtaining SSL certificates via Let's Encrypt ==="
echo "NOTE: DNS must already point baequests.com, www.baequests.com, api.baequests.com → this VM."
echo ""
sudo certbot --nginx \
    -d baequests.com \
    -d www.baequests.com \
    -d api.baequests.com \
    --non-interactive \
    --agree-tos \
    --email "$CERTBOT_EMAIL"
echo "✓ SSL certificates installed. Auto-renewal is handled by certbot's systemd timer."

# ── [6/7] Backup script + cron ───────────────────────────────────────────────
echo ""
echo "=== [6/7] Setting up MongoDB backup ==="

cat > "$USER_HOME/backup.sh" << 'BACKUP_SCRIPT'
#!/bin/bash
# Daily MongoDB Atlas → S3 backup. Runs via cron at 3am.
# Keeps 7 days of backups; older ones are deleted automatically.
set -eo pipefail

get_env() { grep "^$1=" /home/badiakaseydou/.env | cut -d'=' -f2-; }

MONGODB_URI=$(get_env MONGODB_URI)
export AWS_ACCESS_KEY_ID=$(get_env AWS_ACCESS_KEY_ID)
export AWS_SECRET_ACCESS_KEY=$(get_env AWS_SECRET_ACCESS_KEY)
export AWS_DEFAULT_REGION=$(get_env AWS_REGION)
BUCKET=$(get_env AWS_S3_BUCKET_NAME)
DATE=$(date +%Y%m%d)
BACKUP_KEY="backups/baequest-${DATE}.archive"

echo "[$(date)] Starting backup → s3://${BUCKET}/${BACKUP_KEY}"
mongodump --uri="${MONGODB_URI}" --archive --gzip | aws s3 cp - "s3://${BUCKET}/${BACKUP_KEY}"
echo "[$(date)] Backup complete."

# Delete backups older than 7 days
for i in 8 9 10 11 12 13 14; do
    OLD_DATE=$(date -d "$i days ago" +%Y%m%d 2>/dev/null || date -v-${i}d +%Y%m%d)
    aws s3 rm "s3://${BUCKET}/backups/baequest-${OLD_DATE}.archive" 2>/dev/null || true
done
BACKUP_SCRIPT

chmod +x "$USER_HOME/backup.sh"
echo "✓ backup.sh written to $USER_HOME/backup.sh"

# Add cron job (idempotent)
if ! crontab -l 2>/dev/null | grep -qF "backup.sh"; then
    (crontab -l 2>/dev/null; echo "0 3 * * * $USER_HOME/backup.sh >> $USER_HOME/backup.log 2>&1") | crontab -
    echo "✓ Cron job added (daily 3am)."
else
    echo "✓ Cron job already present."
fi

sudo systemctl enable cron
sudo systemctl start cron

# ── [7/7] Deploy SSH key ─────────────────────────────────────────────────────
echo ""
echo "=== [7/7] Adding CI/CD deploy SSH key ==="
echo ""
echo "Paste the PUBLIC key for deploy-key-cicd (the public half of the GC_SSH_KEY"
echo "GitHub secret). You can get it by running on your local machine:"
echo "  ssh-keygen -y -f ~/.ssh/deploy_key"
echo ""
echo -n "Public key: "
read -r DEPLOY_PUBLIC_KEY

mkdir -p "$USER_HOME/.ssh"
chmod 700 "$USER_HOME/.ssh"
touch "$USER_HOME/.ssh/authorized_keys"
chmod 600 "$USER_HOME/.ssh/authorized_keys"

if [ -n "$DEPLOY_PUBLIC_KEY" ]; then
    if ! grep -qF "$DEPLOY_PUBLIC_KEY" "$USER_HOME/.ssh/authorized_keys"; then
        echo "$DEPLOY_PUBLIC_KEY" >> "$USER_HOME/.ssh/authorized_keys"
        echo "✓ Deploy key added to authorized_keys."
    else
        echo "✓ Deploy key already present."
    fi
else
    echo "⚠ No key entered — skipped. Add it manually:"
    echo "  echo '<public key>' >> $USER_HOME/.ssh/authorized_keys"
fi

# ── Final state ───────────────────────────────────────────────────────────────
# Initialize blue-green active-port tracker if not already present
if [ ! -f "$USER_HOME/.active-port" ]; then
    echo "3001" > "$USER_HOME/.active-port"
    echo "✓ .active-port initialized to 3001."
fi

echo ""
echo "════════════════════════════════════════"
echo " Bootstrap complete!"
echo "════════════════════════════════════════"
echo ""
echo "Next steps:"
echo ""
echo "1. Log out and back in so Docker group membership takes effect."
echo ""
echo "2. Deploy both containers by pushing to main on each repo:"
echo "   - Backend:  push to seydou31/se-final-project-backend"
echo "   - Frontend: push to seydou31/se-final-project"
echo "   CI writes the .env file and starts the containers automatically."
echo ""
echo "3. Verify everything is up:"
echo "   docker ps"
echo "   curl -sf https://api.baequests.com/health"
echo ""
