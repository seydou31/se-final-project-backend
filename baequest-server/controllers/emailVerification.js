const crypto = require('crypto');
const User = require('../models/user');
const EmailVerification = require('../models/emailVerification');
const { sendVerificationEmail } = require('../utils/email');
const logger = require('../utils/logger');

// Send verification email
const sendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Generate secure random token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Hash the token before storing
    const hashedToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    // Delete any existing verification tokens for this user
    await EmailVerification.deleteMany({ userId: user._id });

    // Create new verification document with 24-hour expiration
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await EmailVerification.create({
      userId: user._id,
      token: hashedToken,
      expiresAt,
    });

    // Send email with unhashed token
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
    await sendVerificationEmail(email, verificationUrl);

    return res.status(200).json({
      message: 'Verification email sent successfully. Please check your inbox.'
    });
  } catch (error) {
    logger.error('Send verification error:', error);
    return res.status(500).json({ error: 'Failed to send verification email' });
  }
};

// Verify email with token
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Hash the provided token to compare with stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find valid, unused verification token
    const verificationRequest = await EmailVerification.findOne({
      token: hashedToken,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!verificationRequest) {
      return res.status(400).json({
        error: 'Invalid or expired verification token. Please request a new verification email.'
      });
    }

    // Find the user
    const user = await User.findById(verificationRequest.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    await user.save();

    // Delete all verification tokens for this user (including the current one)
    await EmailVerification.deleteMany({ userId: user._id });

    return res.status(200).json({ message: 'Email verified successfully' });
  } catch (error) {
    logger.error('Email verification error:', error);
    return res.status(500).json({ error: 'Failed to verify email' });
  }
};

module.exports = {
  sendVerification,
  verifyEmail,
};
