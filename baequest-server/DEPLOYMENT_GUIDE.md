# BaeQuest Deployment Guide

## Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [AWS S3 Setup](#aws-s3-setup)
5. [Email Configuration](#email-configuration)
6. [Deployment Platforms](#deployment-platforms)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### Security
- [ ] Generate new JWT_SECRET for production (different from development)
- [ ] Review all environment variables for sensitive data
- [ ] Ensure `.env` files are in `.gitignore`
- [ ] Enable HTTPS/SSL certificates
- [ ] Set up CORS with specific allowed origins
- [ ] Review file upload security middleware
- [ ] Verify password hashing is enabled (bcrypt)
- [ ] Test email verification flow

### Code Quality
- [ ] Run all tests: `npm test`
- [ ] Check test coverage (target: 60%+)
- [ ] Review and fix linting errors
- [ ] Remove console.logs from production code (or use proper logger)
- [ ] Verify no hardcoded credentials

### Performance
- [ ] Test with realistic data volume
- [ ] Verify database indexes are in place
- [ ] Enable image optimization (CONVERT_TO_WEBP=true)
- [ ] Test API response times (<500ms average)

### Functionality
- [ ] Test complete user flow (signup → verify → login → profile → event)
- [ ] Test file upload with various image types
- [ ] Test password reset flow
- [ ] Test Google OAuth integration
- [ ] Test WebSocket connections
- [ ] Verify error handling and user feedback

---

## Environment Configuration

### 1. Production Environment Variables

Copy `.env.production.example` to `.env` on your production server and fill in actual values:

```bash
# Generate JWT Secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Set in your hosting platform's environment variables or .env file
JWT_SECRET=<generated_secret>
MONGODB_URI=<your_production_mongodb_uri>
AWS_ACCESS_KEY_ID=<your_aws_key>
AWS_SECRET_ACCESS_KEY=<your_aws_secret>
GOOGLE_CLIENT_ID=<your_production_google_client_id>
RESEND_API_KEY=<your_resend_api_key>
FRONTEND_URL=https://baequests.com
NODE_ENV=production
```

### 2. Frontend Environment Variables

Update `baequest/.env.production`:

```bash
VITE_API_BASE_URL=https://api.baequests.com
VITE_GOOGLE_CLIENT_ID=<your_production_google_client_id>
VITE_GA_TRACKING_ID=<your_google_analytics_id>
```

---

## Database Setup

### MongoDB Atlas (Recommended for Production)

1. **Create Production Cluster**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create new cluster (M2 or higher for production)
   - Region: Choose closest to your users

2. **Configure Network Access**
   - Add IP addresses of your production servers
   - Or use `0.0.0.0/0` with strong authentication (less secure)

3. **Create Database User**
   - Database → Database Access → Add New Database User
   - Use strong password
   - Grant `readWrite` permissions for `baequest` database

4. **Get Connection String**
   - Connect → Connect Your Application
   - Copy connection string
   - Replace `<password>` and `<dbname>` with your values

5. **Set Up Indexes** (Run these in MongoDB shell)
   ```javascript
   // User indexes
   db.users.createIndex({ email: 1 }, { unique: true });
   db.users.createIndex({ googleId: 1 }, { sparse: true });

   // Profile indexes
   db.profiles.createIndex({ owner: 1 }, { unique: true });

   // Event indexes
   db.events.createIndex({ startDate: 1 });
   db.events.createIndex({ location: "2dsphere" });

   // Email verification TTL index
   db.emailverifications.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
   ```

---

## AWS S3 Setup

### 1. Create S3 Bucket

```bash
# AWS CLI method
aws s3 mb s3://baequests-profile-pictures-prod --region us-east-1

# Or use AWS Console: https://console.aws.amazon.com/s3/
```

### 2. Configure Bucket Permissions

**Bucket Policy** (allows public read access for profile pictures):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::baequests-profile-pictures-prod/*"
    }
  ]
}
```

**CORS Configuration**:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "POST", "PUT"],
    "AllowedOrigins": ["https://baequests.com", "https://www.baequests.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### 3. Create IAM User for Backend

1. Go to IAM → Users → Add User
2. User name: `baequest-backend-prod`
3. Access type: Programmatic access
4. Attach policy: `AmazonS3FullAccess` (or create custom policy with limited permissions)
5. Save Access Key ID and Secret Access Key
6. Add to environment variables

---

## Email Configuration

### Resend Setup

1. **Sign up** at [Resend.com](https://resend.com)

2. **Verify Domain**
   - Add your domain (e.g., `baequests.com`)
   - Add DNS records as instructed
   - Wait for verification (can take a few hours)

3. **Create API Key**
   - Settings → API Keys → Create API Key
   - Name: "Production Backend"
   - Permissions: Full Access
   - Copy API key → Save to `RESEND_API_KEY`

4. **Set Email From Address**
   - Use verified domain: `noreply@baequests.com`
   - Set in `EMAIL_FROM` environment variable

5. **Test Email Delivery**
   ```bash
   # Run this on your server
   curl -X POST https://api.resend.com/emails \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "from": "noreply@baequests.com",
       "to": "your-email@example.com",
       "subject": "Test Email",
       "html": "<p>Production email test</p>"
     }'
   ```

---

## Deployment Platforms

### Option 1: Render (Recommended for Easy Setup)

#### Backend Deployment

1. **Create Web Service**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - New → Web Service
   - Connect GitHub repository

2. **Configure Service**
   ```
   Name: baequest-backend
   Region: Oregon (or closest to users)
   Branch: main
   Root Directory: baequest-server
   Environment: Node
   Build Command: npm install
   Start Command: npm start
   Instance Type: Starter ($7/month) or Standard
   ```

3. **Add Environment Variables**
   - Settings → Environment
   - Add all variables from `.env.production.example`

4. **Deploy**
   - Render will automatically deploy on push to main branch

#### Frontend Deployment

1. **Create Static Site**
   - New → Static Site
   - Connect GitHub repository

2. **Configure**
   ```
   Name: baequest-frontend
   Branch: main
   Root Directory: baequest
   Build Command: npm install && npm run build
   Publish Directory: dist
   ```

3. **Add Environment Variables**
   - Add VITE_* variables

### Option 2: Railway

Similar process to Render, but with different UI. Railway offers $5/month free credit.

### Option 3: AWS EC2 + Nginx (Advanced)

See separate guide: `AWS_DEPLOYMENT.md`

---

## Post-Deployment Verification

### 1. Health Check

Test these endpoints:

```bash
# Backend health
curl https://api.baequests.com/health

# Should return 200 OK
```

### 2. User Flow Test

1. Sign up new user
2. Verify email (check spam folder)
3. Log in
4. Create profile
5. Upload profile picture
6. Browse events
7. Check in to event
8. Test real-time features

### 3. Monitor Logs

```bash
# Render
render logs -f

# Railway
railway logs

# AWS EC2
pm2 logs
```

### 4. Performance Check

- Test API response times
- Check image upload speed
- Verify WebSocket connections
- Test under load (use tool like Apache Bench or k6)

---

## Troubleshooting

### Common Issues

#### 1. Email Verification Emails Not Sending

**Symptoms**: Users not receiving verification emails

**Solutions**:
- Check Resend dashboard for failed emails
- Verify domain DNS records are correct
- Check `EMAIL_FROM` uses verified domain
- Look for emails in spam folder
- Verify `RESEND_API_KEY` is correct
- Check backend logs for email service errors

#### 2. File Upload Failing

**Symptoms**: Profile picture upload returns error

**Solutions**:
- Verify S3 bucket exists and is accessible
- Check AWS credentials are correct
- Verify bucket CORS configuration
- Check file size (max 5MB)
- Review file validation middleware logs
- Test S3 access with AWS CLI

#### 3. Database Connection Errors

**Symptoms**: "MongoServerError: Authentication failed"

**Solutions**:
- Verify MongoDB Atlas IP whitelist
- Check database username/password
- Ensure connection string format is correct
- Test connection with MongoDB Compass
- Check database user permissions

#### 4. CORS Errors

**Symptoms**: "Access-Control-Allow-Origin" errors in browser

**Solutions**:
- Verify `ALLOWED_ORIGINS` includes frontend domain
- Check both HTTP and HTTPS are configured
- Ensure credentials: 'include' is set in frontend
- Review CORS middleware in `app.js`

#### 5. WebSocket Connection Issues

**Symptoms**: Real-time features not working

**Solutions**:
- Verify Socket.io is properly initialized
- Check hosting platform supports WebSockets
- Review WebSocket upgrade headers
- Test with Socket.io debug mode

---

## Monitoring Best Practices

### 1. Error Tracking

Integrate Sentry or similar:

```bash
npm install @sentry/node
```

```javascript
// Add to app.js
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

// Error handler
app.use(Sentry.Handlers.errorHandler());
```

### 2. Uptime Monitoring

Use services like:
- UptimeRobot (free)
- Pingdom
- StatusCake

### 3. Performance Monitoring

- New Relic
- Datadog
- AWS CloudWatch (if using AWS)

---

## Rollback Procedure

If deployment fails:

### Render/Railway
1. Go to Deployments
2. Click "Rollback" on previous successful deployment

### Manual Deployment
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or checkout specific commit
git checkout <previous-commit-hash>
git push origin main --force
```

---

## Security Hardening

### Additional Production Security

1. **Rate Limiting**
   ```javascript
   const rateLimit = require("express-rate-limit");

   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100 // limit each IP to 100 requests per windowMs
   });

   app.use("/api/", limiter);
   ```

2. **Helmet.js** (already configured)
   - Ensures security headers are set

3. **Input Validation**
   - All inputs validated with Joi schemas

4. **File Upload Security**
   - Magic number validation
   - EXIF metadata stripping
   - File size limits

---

## Support and Maintenance

### Regular Maintenance Tasks

**Weekly**:
- Review error logs
- Check uptime metrics
- Monitor database size

**Monthly**:
- Update dependencies: `npm update`
- Review security advisories: `npm audit`
- Backup database
- Review API usage patterns

**Quarterly**:
- Security audit
- Performance review
- Update Node.js version
- Review and optimize database queries

---

## Additional Resources

- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [Resend Documentation](https://resend.com/docs)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Production Best Practices](https://github.com/goldbergyoni/nodebestpractices)

---

**Last Updated**: January 25, 2026
**Version**: 1.0
