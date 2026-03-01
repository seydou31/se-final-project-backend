const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

/**
 * Send SMS notification when a user checks in at an event.
 * Silently no-ops if AWS credentials are not configured.
 * @param {string} toPhone - E.164 phone number (e.g. +12025551234)
 * @param {string} checkedInName - Name of the user who checked in
 * @param {string} eventName - Name of the event
 */
const sendCheckinNotification = async (toPhone, checkedInName, eventName) => {
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) return;

  const sns = new SNSClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  await sns.send(new PublishCommand({
    Message: `${checkedInName} just checked in at ${eventName} on BaeQuest! Open the app to connect.`,
    PhoneNumber: toPhone,
    MessageAttributes: {
      'AWS.MM.SMS.OriginationNumber': {
        DataType: 'String',
        StringValue: process.env.SMS_ORIGINATION_NUMBER || '+18555329045',
      },
    },
  }));
};

module.exports = { sendCheckinNotification };
