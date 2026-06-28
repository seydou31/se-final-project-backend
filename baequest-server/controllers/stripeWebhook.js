const Stripe = require('stripe');
const CuratedEvent = require('../models/curatedEvent');
const logger = require('../utils/logger');
const { completeEventCheckin, notifyCompatibleUsers } = require('../services/eventCheckinService');

const getStripe = () => Stripe(process.env.STRIPE_SECRET_KEY);

module.exports.stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = getStripe().webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

   try {
    switch (stripeEvent.type) {
      case "checkout.session.completed": {
        const session =
          stripeEvent.data.object;

        const {
          userId,
          eventId,
          lat,
          lng,
        } = session.metadata || {};

        if (
          !userId ||
          !eventId
        ) {
          logger.warn(
            "Missing metadata in checkout session"
          );
          break;
        }

        const io =
          req.app.get("io");

        const eventDoc =
          await CuratedEvent.findById(
            eventId
          );

        if (!eventDoc) {
          logger.error(
            `Event not found: ${eventId}`
          );
          break;
        }

        console.log("WEBHOOK START");

        console.log("checkedInUsers:", eventDoc.checkedInUsers);
        console.log("userId:", userId);

        // Prevent duplicate webhook processing
       const alreadyCheckedIn =
          eventDoc.checkedInUsers?.some(
            (id) => String(id) === String(userId)
          );

        console.log("alreadyCheckedIn:", alreadyCheckedIn);

        if (alreadyCheckedIn) {
          logger.info(
            `User ${userId} already checked in for event ${eventId}`
          );
          break;
        }

        const result =
          await completeEventCheckin({
            userId,
            event: eventDoc,
            lat:
              Number(lat) || 0,
            lng:
              Number(lng) || 0,
            io,
          });

        // Update event only AFTER successful check-in
        await CuratedEvent.updateOne(
          {
            _id: eventId,
          },
          {
            $addToSet: {
              checkedInUsers:
                userId,
            },
            $inc: {
              paidCheckinCount: 1,
            },
          }
        );

        notifyCompatibleUsers({
          compatibleUsers: result.compatibleUsers,
          currentUserProfile: result.currentUserProfile,
          event: eventDoc,
        });

        logger.info(
          `Paid check-in completed. User: ${userId}, Event: ${eventId}`
        );

        console.log(
          "Paid check-in result:",
          {
            userId,
            eventId,
            users:
              result
                ?.compatibleUsers
                ?.length || 0,
          }
        );

        break;
      }

      default:
        break;
    }

    return res.json({
      received: true,
    });
  } catch (err) {
    logger.error(
      "Stripe webhook processing failed:",
      err
    );

    return res.json({
      received: true,
    });
  }
};
