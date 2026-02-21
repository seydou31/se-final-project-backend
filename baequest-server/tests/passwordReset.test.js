// Mock email util before any requires so the controller never calls Resend
jest.mock('../utils/email', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendFeedbackRequestEmail: jest.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
}));

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const User = require('../models/user');
const PasswordReset = require('../models/passwordReset');
const { requestPasswordReset, resetPassword } = require('../controllers/passwordReset');

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  app = express();
  app.use(express.json());
  app.post('/password-reset/request', requestPasswordReset);
  app.post('/password-reset/reset', resetPassword);
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ message: err.message, error: err.name });
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await PasswordReset.deleteMany({});
  jest.clearAllMocks();
});

// ─── Helper ──────────────────────────────────────────────────────────────────

function makeToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hashed };
}

// ─── POST /password-reset/request ────────────────────────────────────────────

describe('POST /password-reset/request', () => {
  it('should return 200 even when the email does not exist (no user enumeration)', async () => {
    const res = await request(app)
      .post('/password-reset/request')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account/i);
  });

  it('should create a PasswordReset document and return 200 for a valid user', async () => {
    await User.create({ email: 'user@example.com', password: await bcrypt.hash('TestPass1!', 10) });

    const res = await request(app)
      .post('/password-reset/request')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(200);
    const doc = await PasswordReset.findOne({});
    expect(doc).not.toBeNull();
    expect(doc.used).toBe(false);
    expect(doc.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('should replace any existing reset tokens for the same user', async () => {
    const user = await User.create({ email: 'user@example.com', password: await bcrypt.hash('TestPass1!', 10) });
    await PasswordReset.create({ userId: user._id, token: 'stale-hash', expiresAt: new Date(Date.now() + 60000) });

    await request(app)
      .post('/password-reset/request')
      .send({ email: 'user@example.com' });

    const count = await PasswordReset.countDocuments({ userId: user._id });
    expect(count).toBe(1);
    const doc = await PasswordReset.findOne({ userId: user._id });
    expect(doc.token).not.toBe('stale-hash');
  });

  it('should return 400 for a Google OAuth account that has no password', async () => {
    await User.create({ email: 'google@example.com', googleId: 'gid-123' });

    const res = await request(app)
      .post('/password-reset/request')
      .send({ email: 'google@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/google/i);
  });
});

// ─── POST /password-reset/reset ──────────────────────────────────────────────

describe('POST /password-reset/reset', () => {
  it('should return 400 when token is missing', async () => {
    const res = await request(app)
      .post('/password-reset/reset')
      .send({ newPassword: 'NewPass1!' });

    expect(res.status).toBe(400);
  });

  it('should return 400 when newPassword is missing', async () => {
    const res = await request(app)
      .post('/password-reset/reset')
      .send({ token: 'sometoken' });

    expect(res.status).toBe(400);
  });

  it('should return 400 for an invalid token', async () => {
    const res = await request(app)
      .post('/password-reset/reset')
      .send({ token: 'not-a-real-token', newPassword: 'NewPass1!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  it('should reset the password and return 200 with a valid token', async () => {
    const user = await User.create({ email: 'user@example.com', password: await bcrypt.hash('OldPass1!', 10) });
    const { raw, hashed } = makeToken();
    await PasswordReset.create({ userId: user._id, token: hashed, expiresAt: new Date(Date.now() + 30 * 60 * 1000) });

    const res = await request(app)
      .post('/password-reset/reset')
      .send({ token: raw, newPassword: 'NewPass1!' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/successfully reset/i);

    const updated = await User.findById(user._id).select('+password');
    const matches = await bcrypt.compare('NewPass1!', updated.password);
    expect(matches).toBe(true);
  });

  it('should delete all reset tokens after a successful reset', async () => {
    const user = await User.create({ email: 'user@example.com', password: await bcrypt.hash('OldPass1!', 10) });
    const { raw, hashed } = makeToken();
    await PasswordReset.create({ userId: user._id, token: hashed, expiresAt: new Date(Date.now() + 30 * 60 * 1000) });

    await request(app)
      .post('/password-reset/reset')
      .send({ token: raw, newPassword: 'NewPass1!' });

    const remaining = await PasswordReset.countDocuments({ userId: user._id });
    expect(remaining).toBe(0);
  });

  it('should return 400 for an already-used token', async () => {
    const user = await User.create({ email: 'user@example.com', password: await bcrypt.hash('OldPass1!', 10) });
    const { raw, hashed } = makeToken();
    await PasswordReset.create({ userId: user._id, token: hashed, expiresAt: new Date(Date.now() + 30 * 60 * 1000), used: true });

    const res = await request(app)
      .post('/password-reset/reset')
      .send({ token: raw, newPassword: 'NewPass1!' });

    expect(res.status).toBe(400);
  });

  it('should return 400 for an expired token', async () => {
    const user = await User.create({ email: 'user@example.com', password: await bcrypt.hash('OldPass1!', 10) });
    const { raw, hashed } = makeToken();
    await PasswordReset.create({ userId: user._id, token: hashed, expiresAt: new Date(Date.now() - 1000) });

    const res = await request(app)
      .post('/password-reset/reset')
      .send({ token: raw, newPassword: 'NewPass1!' });

    expect(res.status).toBe(400);
  });
});
