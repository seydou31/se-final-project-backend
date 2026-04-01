const Stripe = require('stripe');
const CuratedEvent = require('../models/curatedEvent');
const profile = require('../models/profile');
const logger = require('../utils/logger');

const getStripe = () => Stripe(process.env.STRIPE_SECRET_KEY);

// Shared checkin completion logic (used by webhook after payment)
// Note: checkedInUsers is already updated atomically before calling this function
async function performCheckin(userId, eventId, lat, lng, io) {
  const currentUserProfile = await profile.findOneAndUpdate(
    { owner: userId },
    { location: { eventId, lat, lng, updatedAt: new Date() } },
    { new: true }
  );

  if (!currentUserProfile) return;

  if (io) {
    io.to(`event_${eventId}`).emit('user-checked-in', {
      user: currentUserProfile,
      eventId,
    });
  }
}

module.exports.stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = getStripe().webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, eventId, lat, lng } = session.metadata;

    try {
      const io = req.app.get('io');

      // Idempotency: use findOneAndUpdate to atomically add user and detect if already present
      const updated = await CuratedEvent.findOneAndUpdate(
        { _id: eventId, checkedInUsers: { $ne: userId } },
        { $addToSet: { checkedInUsers: userId }, $inc: { paidCheckinCount: 1 } },
        { new: false }
      );

      if (updated) {
        // User was not already checked in — complete the checkin
        await performCheckin(userId, eventId, parseFloat(lat), parseFloat(lng), io);
        logger.info(`Webhook: checked in user ${userId} at event ${eventId} after payment`);
      } else {
        logger.info(`Webhook: user ${userId} already checked in at event ${eventId}, skipping duplicate`);
      }
    } catch (err) {
      logger.error('Webhook checkin failed:', err);
    }
  }

  return res.json({ received: true });
};
