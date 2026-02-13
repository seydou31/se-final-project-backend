# SendGrid Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Verify Your Sender Email (REQUIRED)

1. **Login to SendGrid**: [https://app.sendgrid.com/](https://app.sendgrid.com/)

2. **Navigate to Sender Authentication**:
   - Click **Settings** (left sidebar)
   - Click **Sender Authentication**

3. **Choose Single Sender Verification** (easiest option):
   - Click the **"Verify a Single Sender"** button

4. **Fill out the form**:
   ```
   From Name: BaeQuest
   From Email Address: [YOUR EMAIL - e.g., you@gmail.com or admin@baequests.com]
   Reply To: [Same as from email]
   Company Address: [Your address]
   City: [Your city]
   State: [Your state]
   Zip Code: [Your zip]
   Country: United States (or your country)
   ```

5. **Click "Create"**

6. **Check your email inbox** and click the verification link

7. **Update your .env file** with the verified email:
   ```env
   SENDGRID_VERIFIED_SENDER=your-verified-email@example.com
   ```

### Step 2: Test It Works

1. **Restart your backend server** (to load the new .env variable):
   ```bash
   # Press Ctrl+C to stop the server, then:
   npm start
   ```

2. **Test password reset**:
   - Go to your app's login page
   - Click "Forgot Password?"
   - Enter an email address that exists in your database
   - Check the inbox of that email for the reset link

### Step 3: Check Email Delivery

If email doesn't arrive:

1. **Check SendGrid Activity Feed**:
   - Go to [Activity Feed](https://app.sendgrid.com/email_activity)
   - Look for your email attempt
   - Check status (Delivered, Processed, Dropped, etc.)

2. **Check spam folder** of recipient email

3. **Verify sender email is verified**:
   - Go to **Settings** → **Sender Authentication**
   - You should see a green checkmark next to your email

## 📧 Which Email Should You Use?

### Option 1: Personal Email (Gmail, Outlook, etc.)
✅ **Best for**: Testing, development, small projects
✅ **Pros**: Quick setup, no domain needed
❌ **Cons**: Looks less professional

**Example**: `youremail@gmail.com`

### Option 2: Custom Domain Email
✅ **Best for**: Production, professional apps
✅ **Pros**: Professional appearance, better deliverability
❌ **Cons**: Requires domain ownership and DNS setup

**Example**: `noreply@baequests.com`

**To use custom domain**:
1. You need to own the domain (baequests.com)
2. Use "Authenticate Your Domain" instead of "Single Sender"
3. Add DNS records as instructed by SendGrid
4. Wait for DNS propagation (can take 24-48 hours)

## ⚠️ Important Notes

1. **Sender email MUST be verified** before emails will send
2. **Free tier**: SendGrid gives you 100 emails/day for free
3. **API Key is already set** in your .env file
4. **Don't share your API key** - it's like a password

## 🎯 Current Setup

Your `.env` file currently has:
```env
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_VERIFIED_SENDER=noreply@baequests.com
FRONTEND_URL=https://baequests.com
```

**Action needed**: Update `SENDGRID_VERIFIED_SENDER` to match whatever email you verify in SendGrid.

## 🚨 Troubleshooting

### "Sender email is not verified" error?
→ You need to verify your sender email in SendGrid (see Step 1 above)

### Email not arriving?
1. Check spam folder
2. Check SendGrid Activity Feed
3. Verify sender email is verified
4. Make sure server was restarted after changing .env

### "403 Forbidden" error?
→ Your API key might be invalid. Generate a new one in SendGrid:
   - Settings → API Keys → Create API Key → Full Access

### Want to test without sending real emails?
→ Use a service like [Mailtrap](https://mailtrap.io/) or [MailHog](https://github.com/mailhog/MailHog) for development

## 📊 SendGrid Dashboard

After setup, you can monitor:
- **Activity Feed**: See all sent emails
- **Stats**: Email delivery rates, bounces, opens
- **Email Activity**: Track individual email status

## ✅ Verification Checklist

- [ ] SendGrid API key in .env
- [ ] Sender email verified in SendGrid dashboard
- [ ] Sender email updated in .env
- [ ] Backend server restarted
- [ ] Test email sent successfully
- [ ] Reset link works and redirects correctly

---

**Once sender email is verified, you're all set!** 🎉

The password reset feature is production-ready with:
- Secure token hashing
- 30-minute expiration
- One-time use tokens
- Professional email templates
- Full error handling
