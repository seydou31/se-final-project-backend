const User = require('../models/user');
const CuratedEvent = require('../models/curatedEvent');
const logger = require('../utils/logger');

const ticketPriceDollars = () => parseInt(process.env.TICKET_PRICE || '0', 10) / 100;
const MANAGER_SHARE = 0.30;

module.exports.getAdminOverview = async (req, res, next) => {
  try {
    const managers = await User.find({ role: 'eventManager' }).lean();

    const result = await Promise.all(managers.map(async (manager) => {
      const events = await CuratedEvent.find({ createdBy: manager._id }).lean();

      const eventsWithEarnings = events.map(event => {
        const earnings = parseFloat(((event.paidCheckinCount || 0) * ticketPriceDollars() * MANAGER_SHARE).toFixed(2));
        return {
          _id: event._id,
          name: event.name,
          startTime: event.startTime,
          endTime: event.endTime,
          city: event.city,
          state: event.state,
          paidCheckinCount: event.paidCheckinCount || 0,
          earnings,
        };
      });

      const totalEarnings = parseFloat(eventsWithEarnings.reduce((sum, e) => sum + e.earnings, 0).toFixed(2));

      return {
        _id: manager._id,
        name: manager.name,
        email: manager.email,
        stripeOnboardingComplete: manager.stripeOnboardingComplete,
        createdAt: manager.createdAt,
        totalEvents: events.length,
        totalEarnings,
        events: eventsWithEarnings,
      };
    }));

    res.status(200).json(result);
  } catch (err) {
    logger.error('Admin overview error:', err);
    next(err);
  }
};
