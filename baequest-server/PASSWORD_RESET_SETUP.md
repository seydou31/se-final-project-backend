# Password Reset Feature - Setup Guide

This guide will help you complete the setup for the password reset feature using SendGrid.

## 🎉 What's Already Done

✅ Frontend components created (ForgotPasswordModal, ResetPasswordPage)
✅ Backend API routes implemented
✅ SendGrid email service integrated
✅ Password reset database model created
✅ SendGrid API key added to .env
✅ Security features: token hashing, expiration, rate limiting

## 📋 What You Need to Do

### 1. Verify Your Sender Email in SendGrid

SendGrid requires you to verify the email address you'll send from. You have two options:

#### Option A: Single Sender Verification (Easiest - Recommended)

1. Go to [SendGrid Dashboard](https://app.sendgrid.com/)
2. Navigate to **Settings** → **Sender Authentication**
3. Click **Verify a Single Sender**
4. Fill out the form with:
   - **From Name**: BaeQuest
   - **From Email Address**: Use an email you own (e.g., `your-email@gmail.com` or `noreply@yourdomain.com`)
   - **Reply To**: Same as from email
   - Fill in the address fields
5. Click **Create**
6. Check your email and click the verification link
7. Update your `.env` file with the verified email:
   ```
   SENDGRID_VERIFIED_SENDER=your-verified-email@example.com
   ```

#### Option B: Domain Authentication (Better for production)

If you own `baequests.com`:
1. Go to **Settings** → **Sender Authentication**
2. Click **Authenticate Your Domain**
3. Follow the DNS setup instructions
4. Once verified, you can use any email from your domain

### 2. Test the Password Reset Flow

#### Local Testing:

1. Start your backend server:
   ```bash
   cd baequest-server
   npm start
   ```

2. Start your frontend:
   ```bash
   cd baequest
   npm run dev
   ```

3. Test the flow:
   - Go to login page
   - Click "Forgot Password?"
   - Enter your email
   - Check your inbox for the reset email
   - Click the link in the email
   - Enter a new password
   - Try logging in with the new password

### 3. Update Frontend URL for Production

In your `.env` file, make sure `FRONTEND_URL` matches your production URL:

```env
# For production
FRONTEND_URL=https://baequests.com

# For local development (if needed)
# FRONTEND_URL=http://localhost:5173
```

## 🔒 Security Features Implemented

1. **Token Hashing**: Reset tokens are hashed before storage (SHA-256)
2. **Expiration**: Tokens expire after 30 minutes
3. **One-time Use**: Tokens can only be used once
4. **Auto-deletion**: Expired tokens are automatically deleted from database
5. **No User Enumeration**: API doesn't reveal if email exists or not
6. **Password Validation**: New passwords must meet strength requirements
7. **Google OAuth Protection**: Users who signed up with Google cannot reset passwords

## 📁 Files Created/Modified

### Frontend:
- ✅ `baequest/src/components/ForgotPasswordModal.jsx`
- ✅ `baequest/src/components/ResetPasswordPage.jsx`
- ✅ `baequest/src/components/LoginModal.jsx` (added "Forgot Password" link)
- ✅ `baequest/src/components/App.jsx` (integrated password reset)
- ✅ `baequest/src/blocks/modal.css` (success message styling)
- ✅ `baequest/src/blocks/reset-password.css` (new file)
- ✅ `baequest/src/utils/api.js` (added API functions)

### Backend:
- ✅ `baequest-server/models/passwordReset.js` (new model)
- ✅ `baequest-server/controllers/passwordReset.js` (new controller)
- ✅ `baequest-server/utils/email.js` (SendGrid email service)
- ✅ `baequest-server/routes/index.js` (added password reset routes)
- ✅ `baequest-server/.env` (SendGrid configuration)

## 🔧 API Endpoints

### Request Password Reset
```
POST /password-reset/request
Body: { "email": "user@example.com" }
Response: 200 OK (always, for security)
```

### Reset Password
```
POST /password-reset/reset
Body: {
  "token": "reset_token_from_email",
  "newPassword": "newSecurePassword123!"
}
Response: 200 OK with success message
```

## 🎨 Email Template

The password reset email includes:
- BaeQuest branding with pink/purple gradient
- Clear call-to-action button
- 30-minute expiration warning
- Fallback link for copying
- Security notice if user didn't request reset

## 🐛 Troubleshooting

### Email not sending?
1. Check that `SENDGRID_API_KEY` is correct in `.env`
2. Verify your sender email in SendGrid dashboard
3. Check backend console for SendGrid errors
4. Verify `SENDGRID_VERIFIED_SENDER` matches verified email

### Reset link not working?
1. Check that `FRONTEND_URL` in `.env` is correct
2. Verify the `/reset-password` route is accessible
3. Check that token hasn't expired (30 minutes)
4. Ensure token wasn't already used

### Password validation failing?
The password must:
- Be at least 8 characters long
- Contain at least one uppercase letter
- Contain at least one lowercase letter
- Contain at least one number
- Contain at least one special character (@$!%*?&)

## 📊 Database Schema

```javascript
PasswordReset {
  userId: ObjectId (ref: 'user')
  token: String (hashed with SHA-256)
  expiresAt: Date (30 minutes from creation)
  used: Boolean (default: false)
  createdAt: Date (auto)
  updatedAt: Date (auto)
}
```

## 🚀 Production Deployment

When deploying to production:

1. Update `.env` on your production server with:
   - Correct `SENDGRID_API_KEY`
   - Correct `SENDGRID_VERIFIED_SENDER`
   - Production `FRONTEND_URL` (https://baequests.com)

2. Ensure MongoDB indexes are created (they auto-create on first use)

3. Test the complete flow in production environment

## 📞 Support

If you encounter issues:
- Check SendGrid Activity Feed for email delivery status
- Review server logs for detailed error messages
- Verify all environment variables are set correctly

---

**Setup completed!** 🎉

Once you verify your sender email in SendGrid, the password reset feature will be fully functional.
