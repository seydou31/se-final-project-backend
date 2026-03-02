const { Vonage } = require('@vonage/server-sdk');

/**
 * Send SMS notification when a user checks in at an event.
 * Silently no-ops if Vonage credentials are not configured.
 * @param {string} toPhone - E.164 phone number (e.g. +12025551234)
 * @param {string} checkedInName - Name of the user who checked in
 * @param {string} eventName - Name of the event
 */
const sendCheckinNotification = async (toPhone, checkedInName, eventName) => {
  if (!process.env.VONAGE_API_KEY || !process.env.VONAGE_API_SECRET) return;

  const vonage = new Vonage({
    apiKey: process.env.VONAGE_API_KEY,
    apiSecret: process.env.VONAGE_API_SECRET,
  });

  await vonage.sms.send({
    to: toPhone.replace('+', ''),
    from: process.env.VONAGE_PHONE_NUMBER || '14142686747',
    text: `${checkedInName} just checked in at ${eventName} on BaeQuest! Open the app to connect.`,
  });
};

module.exports = { sendCheckinNotification };
