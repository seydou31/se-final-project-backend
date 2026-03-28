const CuratedEvent = require('../models/curatedEvent');
const profile = require('../models/profile');
const logger = require('./logger');

let pendingTimeout = null;
let scheduledUntil = null;
let _io = null;

// Clear presence for any events that have already ended (catches missed checkouts
// from server downtime / restarts).
async function sweepEndedEvents() {
  const now = new Date();
  const endedEvents = await CuratedEvent.find({ endTime: { $lte: now } }, { _id: 1 });
  if (endedEvents.length === 0) return;

  const endedIds = endedEvents.map(e => e._id);
  const result = await profile.updateMany(
    { 'location.eventId': { $in: endedIds } },
    { $unset: { 'location.eventId': '', 'location.lat': '', 'location.lng': '' }, $set: { 'location.updatedAt': now } }
  );
  if (result.modifiedCount > 0) {
    logger.info(`Auto-checkout sweep: cleared ${result.modifiedCount} users from ${endedIds.length} ended event(s)`);
    // Notify all clients in each ended event's socket room
    if (_io) {
      endedIds.forEach(eventId => {
        _io.to(`event_${eventId}`).emit('event-ended', { eventId });
      });
    }
  }
}

// Schedule a timeout that fires exactly when the next event ends.
// Cancels any existing pending timeout and reschedules if the new event
// ends sooner. Safe to call any time a new event is created.
async function scheduleAutoCheckout(io) {
  if (io) _io = io;
  try {
    // First sweep for any already-ended events (handles restart / missed fires)
    await sweepEndedEvents();

    // Find the soonest upcoming event using chained sort (more reliable than options API)
    const nextEvent = await CuratedEvent.findOne({ endTime: { $gt: new Date() } })
      .sort({ endTime: 1 })
      .select('endTime');

    if (!nextEvent) {
      logger.info('Auto-checkout: no upcoming events, scheduler idle');
      return;
    }

    // Already scheduled for this event or an earlier one — nothing to do
    if (scheduledUntil && scheduledUntil <= nextEvent.endTime) return;

    // Cancel the existing timeout and reschedule for the sooner event
    if (pendingTimeout) clearTimeout(pendingTimeout);

    const msUntilEnd = nextEvent.endTime.getTime() - Date.now();
    // setTimeout max is ~24.8 days; clamp to avoid overflow on far-future events
    const delay = Math.min(msUntilEnd + 1000, 2147483647);
    scheduledUntil = nextEvent.endTime;

    logger.info(`Auto-checkout scheduled for ${nextEvent.endTime.toISOString()}`);

    pendingTimeout = setTimeout(async () => {
      pendingTimeout = null;
      scheduledUntil = null;
      try {
        await sweepEndedEvents();
      } catch (err) {
        logger.error('Auto-checkout failed:', err);
      }
      scheduleAutoCheckout();
    }, delay);
  } catch (err) {
    logger.error('Auto-checkout scheduling failed:', err);
  }
}

module.exports = { scheduleAutoCheckout };
