const CuratedEvent = require('../models/curatedEvent');
const profile = require('../models/profile');
const logger = require('./logger');

let pendingTimeout = null;
let scheduledUntil = null;

// Schedule a timeout that fires exactly when the next event ends.
// Cancels any existing pending timeout and reschedules if the new event
// ends sooner. Safe to call any time a new event is created.
async function scheduleAutoCheckout() {
  try {
    const nextEvent = await CuratedEvent.findOne(
      { endTime: { $gt: new Date() } },
      { endTime: 1 },
      { sort: { endTime: 1 } }
    );

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
        const now = new Date();
        const endedEvents = await CuratedEvent.find({ endTime: { $lte: now } }, { _id: 1 });
        if (endedEvents.length > 0) {
          const endedIds = endedEvents.map(e => e._id);
          const result = await profile.updateMany(
            { 'location.eventId': { $in: endedIds } },
            { $unset: { 'location.eventId': '', 'location.lat': '', 'location.lng': '' }, $set: { 'location.updatedAt': now } }
          );
          if (result.modifiedCount > 0) {
            logger.info(`Auto-checkout: cleared ${result.modifiedCount} users from ${endedIds.length} ended event(s)`);
          }
        }
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
