// setup.js mocks '../utils/email' globally

jest.mock('google-auth-library', () => {
  const mockVerifyIdToken = jest.fn();
  const MockOAuth2Client = jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  }));
  return { OAuth2Client: MockOAuth2Client, getVerifyIdToken: () => mockVerifyIdToken };
});

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client, getVerifyIdToken } = require('google-auth-library');

const User = require('../models/user');
const usersController = require('../controllers/users');
const SECRET = require('../utils/config');

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.post('/refresh', usersController.refreshToken);
  app.post('/auth/google', usersController.googleAuth);
  app.post('/auth/google-token', usersController.googleAuthWithToken);

  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ message: err.message });
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  jest.clearAllMocks();
});

// ─── refreshToken ─────────────────────────────────────────────────────────────

describe('POST /refresh - refreshToken', () => {
  it('should return 401 when no cookie is provided', async () => {
    const res = await request(app).post('/refresh');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/no token/i);
  });

  it('should return 401 for an invalid token', async () => {
    const res = await request(app)
      .post('/refresh')
      .set('Cookie', ['jwt=invalid.jwt.token']);
    expect(res.status).toBe(401);
  });

  it('should return 401 when the user no longer exists in the database', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const token = jwt.sign({ _id: fakeId }, SECRET.JWT_SECRET, { expiresIn: '7d' });

    const res = await request(app)
      .post('/refresh')
      .set('Cookie', [`jwt=${token}`]);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/user not found/i);
  });

  it('should return 200 with a new JWT cookie for a valid token', async () => {
    const u = await User.create({
      email: 'refresh@example.com',
      password: await bcrypt.hash('pass', 10),
    });
    const token = jwt.sign({ _id: u._id }, SECRET.JWT_SECRET, { expiresIn: '7d' });

    const res = await request(app)
      .post('/refresh')
      .set('Cookie', [`jwt=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Token refreshed successfully');
    expect(res.body.user.email).toBe('refresh@example.com');

    const cookies = res.headers['set-cookie'];
    expect(cookies.some(c => c.startsWith('jwt='))).toBe(true);
  });
});

// ─── googleAuth ───────────────────────────────────────────────────────────────

describe('POST /auth/google - googleAuth', () => {
  function mockGooglePayload(payload) {
    const mockTicket = { getPayload: () => payload };
    getVerifyIdToken().mockResolvedValue(mockTicket);
  }

  it('should create a new user and return 200 for an unknown Google account', async () => {
    mockGooglePayload({ sub: 'google-id-new', email: 'brand-new@example.com' });

    const res = await request(app)
      .post('/auth/google')
      .send({ credential: 'valid-google-token' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Google authentication successful');
    expect(res.body.user.email).toBe('brand-new@example.com');

    const created = await User.findOne({ email: 'brand-new@example.com' });
    expect(created.googleId).toBe('google-id-new');
    expect(created.isEmailVerified).toBe(true);
  });

  it('should link an existing email account to a Google ID', async () => {
    await User.create({
      email: 'email-only@example.com',
      password: await bcrypt.hash('pass', 10),
      isEmailVerified: false,
    });

    mockGooglePayload({ sub: 'google-link-id', email: 'email-only@example.com' });

    const res = await request(app)
      .post('/auth/google')
      .send({ credential: 'valid-google-token' });

    expect(res.status).toBe(200);

    const linked = await User.findOne({ email: 'email-only@example.com' });
    expect(linked.googleId).toBe('google-link-id');
    expect(linked.isEmailVerified).toBe(true);
  });

  it('should return 401 when Google token verification fails', async () => {
    getVerifyIdToken().mockRejectedValue(new Error('Token expired'));

    const res = await request(app)
      .post('/auth/google')
      .send({ credential: 'bad-token' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/google authentication failed/i);
  });
});

// ─── googleAuthWithToken ──────────────────────────────────────────────────────

describe('POST /auth/google-token - googleAuthWithToken', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should create a new user for an unknown Google account', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'g-new', email: 'new-token@example.com' }),
    });

    const res = await request(app)
      .post('/auth/google-token')
      .send({ accessToken: 'valid-access-token' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('new-token@example.com');

    const created = await User.findOne({ email: 'new-token@example.com' });
    expect(created.googleId).toBe('g-new');
    expect(created.isEmailVerified).toBe(true);
  });

  it('should link an existing email-only account to a Google ID', async () => {
    await User.create({
      email: 'link-me@example.com',
      password: await bcrypt.hash('pass', 10),
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'g-link', email: 'link-me@example.com' }),
    });

    const res = await request(app)
      .post('/auth/google-token')
      .send({ accessToken: 'access-token' });

    expect(res.status).toBe(200);

    const linked = await User.findOne({ email: 'link-me@example.com' });
    expect(linked.googleId).toBe('g-link');
    expect(linked.isEmailVerified).toBe(true);
  });

  it('should return 200 for an already-linked Google user', async () => {
    await User.create({
      email: 'already@example.com',
      googleId: 'g-already',
      isEmailVerified: true,
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'g-already', email: 'already@example.com' }),
    });

    const res = await request(app)
      .post('/auth/google-token')
      .send({ accessToken: 'access-token' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('already@example.com');
  });

  it('should return 401 when the Google userinfo request fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });

    const res = await request(app)
      .post('/auth/google-token')
      .send({ accessToken: 'bad-token' });

    expect(res.status).toBe(401);
  });

  it('should return 401 when Google returns a payload without an email', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'g-noemail' }), // no email
    });

    const res = await request(app)
      .post('/auth/google-token')
      .send({ accessToken: 'no-email-token' });

    expect(res.status).toBe(401);
  });
});
