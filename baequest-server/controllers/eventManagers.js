const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Stripe = require('stripe');
const User = require('../models/user');
const CuratedEvent = require('../models/curatedEvent');
const EmailVerification = require('../models/emailVerification');
const SECRET = require('../utils/config');
const logger = require('../utils/logger');
const { sendVerificationEmail } = require('../utils/email');

const getStripe = () => Stripe(process.env.STRIPE_SECRET_KEY);

// Ticket price in dollars (env var is in cents, e.g. TICKET_PRICE=500 → $5.00)
const ticketPriceDollars = () => parseInt(process.env.TICKET_PRICE || '0', 10) / 100;
const MANAGER_SHARE = 0.30;

const COOKIE_OPTIONS = {
  maxAge: 3600000 * 24 * 7,
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
};

module.exports.register = async (req, res, next) => {
  const { email, password, name, inviteCode } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ message: 'Email, password, and name are required' });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  if (!process.env.EVENT_MANAGER_INVITE_CODE || inviteCode !== process.env.EVENT_MANAGER_INVITE_CODE) {
    return res.status(403).json({ message: 'Invalid invite code' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const newUser = await User.create({ email, password: hash, name, role: 'eventManager', isEmailVerified: false });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    await EmailVerification.create({
      userId: newUser._id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
    sendVerificationEmail(email, verificationUrl).catch((err) => {
      logger.error('Failed to send event manager verification email:', err);
    });

    return res.status(201).json({ message: 'Account created. Please check your email to verify your account.' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    return next(err);
  }
};

module.exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user || user.role !== 'eventManager') {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const matched = await bcrypt.compare(password, user.password);
    if (!matched) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!user.isEmailVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in' });
    }

    const token = jwt.sign(
      { _id: user._id, tokenVersion: user.tokenVersion },
      SECRET.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res
      .cookie('jwt', token, COOKIE_OPTIONS)
      .json({
        message: 'Logged in',
        stripeOnboardingComplete: user.stripeOnboardingComplete,
        stripeAccountId: !!user.stripeAccountId,
      });
  } catch (err) {
    return next(err);
  }
};

module.exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('email name stripeAccountId stripeOnboardingComplete role');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json({
      email: user.email,
      name: user.name,
      stripeOnboardingComplete: user.stripeOnboardingComplete,
      hasStripeAccount: !!user.stripeAccountId,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports.getDashboard = async (req, res, next) => {
  try {
    const events = await CuratedEvent.find({ createdBy: req.user._id })
      .select('name startTime endTime checkedInUsers paidCheckinCount')
      .lean();

    const price = ticketPriceDollars();

    const eventStats = events.map((event) => ({
      _id: event._id,
      name: event.name,
      startTime: event.startTime,
      endTime: event.endTime,
      checkinCount: event.checkedInUsers?.length || 0,
      earnings: ((event.paidCheckinCount || 0) * price * MANAGER_SHARE).toFixed(2),
    }));

    const totalCheckins = eventStats.reduce((sum, e) => sum + e.checkinCount, 0);
    const totalEarnings = eventStats.reduce((sum, e) => sum + parseFloat(e.earnings), 0).toFixed(2);

    return res.json({
      events: eventStats,
      totalCheckins,
      totalEarnings,
      ticketPrice: price,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports.getStripeOnboardingLink = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    let accountId = user.stripeAccountId;
    if (!accountId) {
      const account = await getStripe().accounts.create({ type: 'express' });
      accountId = account.id;
      user.stripeAccountId = accountId;
      await user.save();
    }

    const origin = process.env.FRONTEND_URL || 'https://baequests.com';
    const accountLink = await getStripe().accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/event-manager/onboarding?refresh=true`,
      return_url: `${origin}/event-manager/onboarding?success=true`,
      type: 'account_onboarding',
    });

    return res.json({ url: accountLink.url });
  } catch (err) {
    logger.error('Stripe onboarding error:', err);
    return next(err);
  }
};

module.exports.verifyStripeOnboarding = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.stripeAccountId) {
      return res.status(400).json({ message: 'No Stripe account found' });
    }

    const account = await getStripe().accounts.retrieve(user.stripeAccountId);
    user.stripeOnboardingComplete = account.details_submitted;
    await user.save();

    return res.json({ onboardingComplete: user.stripeOnboardingComplete });
  } catch (err) {
    logger.error('Stripe verify error:', err);
    return next(err);
  }
};
