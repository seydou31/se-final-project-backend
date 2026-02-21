// Tests for utils/sms.js — sendCheckinNotification
// Mock @aws-sdk/client-sns to avoid real network calls

jest.mock('@aws-sdk/client-sns', () => {
  const mockSend = jest.fn().mockResolvedValue({});
  const MockSNSClient = jest.fn().mockImplementation(() => ({ send: mockSend }));
  MockSNSClient.__mockSend = mockSend;
  return {
    SNSClient: MockSNSClient,
    PublishCommand: jest.fn().mockImplementation((params) => ({ ...params })),
  };
});

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { sendCheckinNotification } = require('../utils/sms');

afterEach(() => {
  // Clean up any AWS env vars set during tests
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.AWS_REGION;
  jest.clearAllMocks();
});

describe('sendCheckinNotification', () => {
  it('should return without sending when AWS credentials are absent', async () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    await sendCheckinNotification('+12025551234', 'Alice', 'Test Event');

    expect(SNSClient).not.toHaveBeenCalled();
    expect(SNSClient.__mockSend).not.toHaveBeenCalled();
  });

  it('should send an SMS with the correct message when AWS credentials are present', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
    process.env.AWS_REGION = 'us-east-1';

    await sendCheckinNotification('+12025551234', 'Alice', 'Rooftop Mixer');

    expect(SNSClient).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'us-east-1',
        credentials: expect.objectContaining({
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
        }),
      })
    );

    expect(PublishCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        PhoneNumber: '+12025551234',
        Message: expect.stringContaining('Alice'),
      })
    );

    expect(PublishCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Message: expect.stringContaining('Rooftop Mixer'),
      })
    );

    expect(SNSClient.__mockSend).toHaveBeenCalled();
  });

  it('should default to us-east-1 when AWS_REGION is not set', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'test-key';
    process.env.AWS_SECRET_ACCESS_KEY = 'test-secret';
    delete process.env.AWS_REGION;

    await sendCheckinNotification('+12025559999', 'Bob', 'Night Out');

    expect(SNSClient).toHaveBeenCalledWith(
      expect.objectContaining({ region: 'us-east-1' })
    );
  });
});
