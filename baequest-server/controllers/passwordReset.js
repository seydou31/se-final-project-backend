const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const PasswordReset = require('../models/passwordReset');
const { sendPasswordResetEmail } = require('../utils/email');
const logger = require('../utils/logger');

// Request password reset
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    // Don't reveal if user exists or not (security best practice)
    if (!user) {
      return res.status(200).json({
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Check if user signed up with Google
    if (user.googleId && !user.password) {
      return res.status(400).json({
        error: 'This account uses Google sign-in. Please sign in with Google.'
      });
    }

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash the token before storing (security best practice)
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Delete any existing reset tokens for this user
    await PasswordReset.deleteMany({ userId: user._id });

    // Create new password reset document with 30-minute expiration
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await PasswordReset.create({
      userId: user._id,
      token: hashedToken,
      expiresAt,
    });

    // Send email with unhashed token
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    await sendPasswordResetEmail(email, resetUrl);

    res.status(200).json({
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (error) {
    logger.error('Password reset request error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
};

// Reset password with token
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Hash the provided token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find valid, unused reset token
    const resetRequest = await PasswordReset.findOne({
      token: hashedToken,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRequest) {
      return res.status(400).json({
        error: 'Invalid or expired reset token. Please request a new password reset.'
      });
    }

    // Find the user
    const user = await User.findById(resetRequest.userId).select('+password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password
    user.password = hashedPassword;
    await user.save();

    // Mark token as used
    resetRequest.used = true;
    await resetRequest.save();

    // Delete all reset tokens for this user
    await PasswordReset.deleteMany({ userId: user._id });

    res.status(200).json({ message: 'Password successfully reset' });
  } catch (error) {
    logger.error('Password reset error:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to reset password' });
  }
};

module.exports = {
  requestPasswordReset,
  resetPassword,
};
