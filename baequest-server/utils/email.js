const { Resend } = require('resend');

// Initialize Resend with API key from environment
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send password reset email
 * @param {string} email - Recipient email address
 * @param {string} resetUrl - Password reset URL with token
 */
const sendPasswordResetEmail = async (email, resetUrl) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: email,
      subject: 'Reset Your BaeQuest Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: linear-gradient(135deg, #fdf2f8 0%, #fae8ff 100%);
              border-radius: 16px;
              padding: 40px;
              border: 2px solid #f9a8d4;
            }
            h1 {
              color: #db2777;
              font-size: 28px;
              margin-bottom: 20px;
            }
            p {
              font-size: 16px;
              margin-bottom: 16px;
            }
            .button {
              display: inline-block;
              padding: 14px 32px;
              background: linear-gradient(135deg, #ec4899 0%, #db2777 100%);
              color: white;
              text-decoration: none;
              border-radius: 50px;
              font-weight: 600;
              margin: 24px 0;
              box-shadow: 0 4px 12px rgba(219, 39, 119, 0.25);
            }
            .footer {
              margin-top: 32px;
              font-size: 14px;
              color: #666;
            }
            .warning {
              background: #fef2f2;
              border-left: 4px solid #dc2626;
              padding: 12px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>💞 Reset Your Password</h1>
            <p>Hi there,</p>
            <p>You requested to reset your password for your BaeQuest account. Click the button below to create a new password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <div class="warning">
              <strong>⏰ This link expires in 30 minutes</strong>
            </div>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #db2777;">${resetUrl}</p>
            <div class="footer">
              <p>If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.</p>
              <p>— The BaeQuest Team</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  } catch (error) {
    console.error('Resend email error:', error);
    throw new Error('Failed to send password reset email');
  }
};

/**
 * Send email verification email
 * @param {string} email - Recipient email address
 * @param {string} verificationUrl - Email verification URL with token
 */
const sendVerificationEmail = async (email, verificationUrl) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: email,
      subject: 'Verify Your BaeQuest Email',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: linear-gradient(135deg, #fdf2f8 0%, #fae8ff 100%);
              border-radius: 16px;
              padding: 40px;
              border: 2px solid #f9a8d4;
            }
            h1 {
              color: #db2777;
              font-size: 28px;
              margin-bottom: 20px;
            }
            p {
              font-size: 16px;
              margin-bottom: 16px;
            }
            .button {
              display: inline-block;
              padding: 14px 32px;
              background: linear-gradient(135deg, #ec4899 0%, #db2777 100%);
              color: white;
              text-decoration: none;
              border-radius: 50px;
              font-weight: 600;
              margin: 24px 0;
              box-shadow: 0 4px 12px rgba(219, 39, 119, 0.25);
            }
            .footer {
              margin-top: 32px;
              font-size: 14px;
              color: #666;
            }
            .warning {
              background: #fef2f2;
              border-left: 4px solid #dc2626;
              padding: 12px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>💞 Welcome to BaeQuest!</h1>
            <p>Hi there,</p>
            <p>Thanks for signing up! Please verify your email address to complete your registration and start connecting with people:</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            <div class="warning">
              <strong>⏰ This link expires in 24 hours</strong>
            </div>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #db2777;">${verificationUrl}</p>
            <div class="footer">
              <p>If you didn't create a BaeQuest account, you can safely ignore this email.</p>
              <p>— The BaeQuest Team</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  } catch (error) {
    console.error('Resend email error:', error);
    throw new Error('Failed to send verification email');
  }
};

/**
 * Send event feedback request email
 * @param {string} email - Recipient email address
 * @param {string} feedbackUrl - Feedback form URL with token
 * @param {object} eventDetails - Event information (name, date, location)
 */
const sendFeedbackRequestEmail = async (email, feedbackUrl, eventDetails) => {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: email,
      subject: `How was your BaeQuest experience at ${eventDetails.name}?`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background-color: white;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #ff3b6c;
              margin: 0;
              font-size: 24px;
            }
            .event-info {
              background-color: #f9f9f9;
              border-left: 4px solid #ff3b6c;
              padding: 15px;
              margin: 20px 0;
            }
            .event-info h2 {
              margin: 0 0 10px 0;
              font-size: 18px;
              color: #333;
            }
            .event-info p {
              margin: 5px 0;
              color: #666;
            }
            .button {
              display: inline-block;
              background-color: #ff3b6c;
              color: white;
              text-decoration: none;
              padding: 14px 30px;
              border-radius: 5px;
              font-weight: bold;
              margin: 20px 0;
              text-align: center;
            }
            .button:hover {
              background-color: #e63360;
            }
            .questions {
              margin: 20px 0;
              padding: 15px;
              background-color: #fff8f9;
              border-radius: 5px;
            }
            .questions h3 {
              color: #ff3b6c;
              margin-top: 0;
            }
            .questions ul {
              margin: 10px 0;
              padding-left: 20px;
            }
            .questions li {
              margin: 8px 0;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              color: #999;
              font-size: 12px;
            }
            .expires {
              background-color: #fff3cd;
              border: 1px solid #ffc107;
              padding: 10px;
              border-radius: 5px;
              margin: 15px 0;
              text-align: center;
              color: #856404;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>💕 How Was Your Experience?</h1>
            </div>

            <p>Hi there! 👋</p>

            <p>Thanks for joining us at <strong>${eventDetails.name}</strong>! We hope you had a great time and maybe even made some connections.</p>

            <div class="event-info">
              <h2>📍 Event Details</h2>
              <p><strong>Event:</strong> ${eventDetails.name}</p>
              <p><strong>Date:</strong> ${eventDetails.date}</p>
              <p><strong>Location:</strong> ${eventDetails.location}</p>
            </div>

            <div class="questions">
              <h3>We'd love your feedback!</h3>
              <p>Your feedback helps us improve BaeQuest for everyone. We're interested in:</p>
              <ul>
                <li>⭐ How would you rate this event? (1-5 stars)</li>
                <li>💬 Any comments about your experience?</li>
                <li>📍 <strong>Know a great meeting place?</strong> Suggest venues that would be perfect for future events!</li>
              </ul>
            </div>

            <div style="text-align: center;">
              <a href="${feedbackUrl}" class="button">Share Your Feedback</a>
            </div>

            <div class="expires">
              ⏰ This feedback link expires in 7 days
            </div>

            <p>Your input helps us create better events and discover amazing new venues. Plus, we love hearing your venue suggestions - you know the best local spots!</p>

            <p>Thank you for being part of the BaeQuest community! 💖</p>

            <div class="footer">
              <p>BaeQuest - Making meaningful connections, one event at a time</p>
              <p>This link is unique to you and expires in 7 days. If you didn't attend this event, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    return true;
  } catch (error) {
    console.error('Failed to send feedback email:', error);
    throw new Error('Failed to send feedback request email');
  }
};

/**
 * Send welcome email to new users
 * @param {string} email - Recipient email address
 */
const sendWelcomeEmail = async (email) => {
  try {
    const appUrl = process.env.FRONTEND_URL || 'https://baequests.com';
    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: email,
      subject: 'Welcome to BaeQuest! Let the adventure begin 💕',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: linear-gradient(135deg, #fdf2f8 0%, #fae8ff 100%);
              border-radius: 16px;
              padding: 40px;
              border: 2px solid #f9a8d4;
            }
            h1 {
              color: #db2777;
              font-size: 28px;
              margin-bottom: 20px;
            }
            p {
              font-size: 16px;
              margin-bottom: 16px;
            }
            .button {
              display: inline-block;
              padding: 14px 32px;
              background: linear-gradient(135deg, #ec4899 0%, #db2777 100%);
              color: white;
              text-decoration: none;
              border-radius: 50px;
              font-weight: 600;
              margin: 24px 0;
              box-shadow: 0 4px 12px rgba(219, 39, 119, 0.25);
            }
            .feature-list {
              background: white;
              border-radius: 12px;
              padding: 20px;
              margin: 20px 0;
            }
            .feature-list h3 {
              color: #db2777;
              margin-top: 0;
            }
            .feature-list ul {
              padding-left: 20px;
            }
            .feature-list li {
              margin: 10px 0;
            }
            .footer {
              margin-top: 32px;
              font-size: 14px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Welcome to BaeQuest! 🎉</h1>
            <p>Hi there,</p>
            <p>We're thrilled to have you join the BaeQuest community! You've taken the first step towards making meaningful connections at events in the DMV area.</p>

            <div class="feature-list">
              <h3>Here's what you can do:</h3>
              <ul>
                <li>🗓️ <strong>Browse Events</strong> - Discover exciting events happening near you</li>
                <li>👋 <strong>Meet People</strong> - Connect with others attending the same events</li>
                <li>💬 <strong>Start Conversations</strong> - Use conversation starters to break the ice</li>
                <li>📍 <strong>Check In</strong> - Let others know you're at an event</li>
              </ul>
            </div>

            <p>Ready to find your next adventure?</p>

            <a href="${appUrl}" class="button">Explore Events</a>

            <div class="footer">
              <p>Happy connecting! 💖</p>
              <p>— The BaeQuest Team</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  } catch (error) {
    console.error('Resend welcome email error:', error);
    // Don't throw - welcome email is not critical
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendFeedbackRequestEmail,
  sendWelcomeEmail,
};
