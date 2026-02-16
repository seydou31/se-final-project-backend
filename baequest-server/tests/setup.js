const mongoose = require('mongoose');

// Set test environment variables before any imports
process.env.NODE_ENV = 'test';
process.env.RESEND_API_KEY = 'test_resend_key_123';
process.env.JWT_SECRET = 'test_secret_key_for_testing';
process.env.FRONTEND_URL = 'http://localhost:5173';

// Increase timeout for all tests
jest.setTimeout(30000);

// Mock Resend email service for tests
jest.mock('../utils/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendFeedbackRequestEmail: jest.fn().mockResolvedValue(true),
}));

// Close database connection after all tests
afterAll(async () => {
  await mongoose.connection.close();
});
