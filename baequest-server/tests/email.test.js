// Override the global email mock from setup.js so we can test the real implementation.
jest.unmock('../utils/email');

// Mock the resend package to avoid real HTTP calls.
jest.mock('resend', () => {
  const mockSend = jest.fn().mockResolvedValue({ id: 'msg_test_123' });
  const MockResend = jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  }));
  
  return { Resend: MockResend, getEmailSendMock: () => mockSend };
});

const { getEmailSendMock } = require('resend');
const {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendFeedbackRequestEmail,
  sendWelcomeEmail,
} = require('../utils/email');

afterEach(() => {
  jest.clearAllMocks();
});

describe('sendPasswordResetEmail', () => {
  it('should call resend.emails.send with correct params', async () => {
    await sendPasswordResetEmail('user@example.com', 'https://example.com/reset?token=abc');

    expect(getEmailSendMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.stringMatching(/reset/i),
        html: expect.stringContaining('https://example.com/reset?token=abc'),
      })
    );
  });

  it('should throw when resend fails', async () => {
    getEmailSendMock().mockRejectedValueOnce(new Error('API error'));

    await expect(
      sendPasswordResetEmail('user@example.com', 'https://example.com/reset')
    ).rejects.toThrow('Failed to send password reset email');
  });
});

describe('sendVerificationEmail', () => {
  it('should call resend.emails.send with verification URL', async () => {
    await sendVerificationEmail('new@example.com', 'https://example.com/verify?token=xyz');

    expect(getEmailSendMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new@example.com',
        subject: expect.stringMatching(/verify/i),
        html: expect.stringContaining('https://example.com/verify?token=xyz'),
      })
    );
  });

  it('should throw when resend fails', async () => {
    getEmailSendMock().mockRejectedValueOnce(new Error('network error'));

    await expect(
      sendVerificationEmail('new@example.com', 'https://example.com/verify')
    ).rejects.toThrow('Failed to send verification email');
  });
});

describe('sendFeedbackRequestEmail', () => {
  const eventDetails = { name: 'Jazz Night', date: '2026-02-20', location: 'The Blue Room' };

  it('should call resend.emails.send with event details in the email', async () => {
    await sendFeedbackRequestEmail('attendee@example.com', 'https://example.com/feedback?token=abc', eventDetails);

    expect(getEmailSendMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'attendee@example.com',
        subject: expect.stringContaining('Jazz Night'),
        html: expect.stringContaining('https://example.com/feedback?token=abc'),
      })
    );
  });

  it('should throw when resend fails', async () => {
    getEmailSendMock().mockRejectedValueOnce(new Error('timeout'));

    await expect(
      sendFeedbackRequestEmail('attendee@example.com', 'https://example.com/feedback', eventDetails)
    ).rejects.toThrow('Failed to send feedback request email');
  });
});

describe('sendWelcomeEmail', () => {
  it('should call resend.emails.send with welcome content', async () => {
    await sendWelcomeEmail('newbie@example.com');

    expect(getEmailSendMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'newbie@example.com',
        subject: expect.stringMatching(/welcome/i),
      })
    );
  });

  it('should NOT throw even when resend fails (welcome email is non-critical)', async () => {
    getEmailSendMock().mockRejectedValueOnce(new Error('resend down'));

    // Should resolve without throwing
    await expect(sendWelcomeEmail('newbie@example.com')).resolves.toBeUndefined();
  });
});
