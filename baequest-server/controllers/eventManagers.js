const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const getStripe = () => require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/user');
const CuratedEvent = require('../models/curatedEvent');
const SECRET = require('../utils/config');
const logger = require('../utils/logger');

// Ticket price in dollars (env var is in cents, e.g. TICKET_PRICE=500 → $5.00)
const ticketPriceDollars = () => parseInt(process.env.TICKET_PRICE || '500', 10) / 100;
const MANAGER_SHARE = 0.30;

const COOKIE_OPTIONS = {
  maxAge: 3600000 * 24 * 7,
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
};

module.exports.register = async (req, res, next) => {
  const { email, password, name } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    await User.create({ email, password: hash, name, role: 'eventManager', isEmailVerified: true });
    return res.status(201).json({ message: 'Event manager account created' });
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
      .select('name startTime endTime checkedInUsers')
      .lean();

    const price = ticketPriceDollars();

    const eventStats = events.map((event) => ({
      _id: event._id,
      name: event.name,
      startTime: event.startTime,
      endTime: event.endTime,
      checkinCount: event.checkedInUsers.length,
      earnings: (event.checkedInUsers.length * price * MANAGER_SHARE).toFixed(2),
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
