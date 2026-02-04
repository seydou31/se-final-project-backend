const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const cookieParser = require('cookie-parser');
const User = require('../models/user');
const EmailVerification = require('../models/emailVerification');
const Profile = require('../models/profile');
const usersController = require('../controllers/users');
const emailController = require('../controllers/emailVerification');
const profileController = require('../controllers/profile');
const auth = require('../middleware/auth');
const { sendVerificationEmail } = require('../utils/email');

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Create test app
  app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Setup routes - full auth flow
  app.post('/signup', usersController.createUser);
  app.post('/signin', usersController.login);
  app.post('/logout', usersController.logout);
  app.post('/email-verification/send', emailController.sendVerification);
  app.post('/email-verification/verify', emailController.verifyEmail);
  app.post('/profile', auth, profileController.createProfile);
  app.get('/profile', auth, profileController.getProfile);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await EmailVerification.deleteMany({});
  await Profile.deleteMany({});
  sendVerificationEmail.mockClear();
});

describe('Complete Authentication Flow Integration Tests', () => {
  describe('User Registration and Email Verification', () => {
    test('should complete full signup → email verification → login → profile creation flow', async () => {
      // Step 1: Sign up
      const signupData = {
        email: 'test@example.com',
        password: 'TestPass123!'
      };

      const signupResponse = await request(app)
        .post('/signup')
        .send(signupData);

      expect(signupResponse.status).toBe(201);
      expect(signupResponse.body.email).toBe(signupData.email);
      expect(sendVerificationEmail).toHaveBeenCalledTimes(1);

      // Verify email verification document was created
      const user = await User.findOne({ email: signupData.email });
      expect(user).toBeTruthy();
      expect(user.isEmailVerified).toBe(false);

      const verificationDoc = await EmailVerification.findOne({ userId: user._id });
      expect(verificationDoc).toBeTruthy();
      expect(verificationDoc.expiresAt).toBeInstanceOf(Date);

      // Step 2: Attempt login before verification (should fail)
      const loginResponse1 = await request(app)
        .post('/signin')
        .send(signupData);

      expect(loginResponse1.status).toBe(401);
      expect(loginResponse1.body.message).toContain('verify your email');

      // Step 3: Get verification email mock call to extract token
      const emailCall = sendVerificationEmail.mock.calls[0];
      const verificationUrl = emailCall[1];
      const token = verificationUrl.split('token=')[1];

      // Step 4: Verify email
      const verifyResponse = await request(app)
        .post('/email-verification/verify')
        .send({ token });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.message).toBe('Email verified successfully');

      // Confirm user is verified in database
      const verifiedUser = await User.findOne({ email: signupData.email });
      expect(verifiedUser.isEmailVerified).toBe(true);

      // Confirm verification doc was deleted
      const deletedDoc = await EmailVerification.findOne({ userId: user._id });
      expect(deletedDoc).toBeNull();

      // Step 5: Login after verification (should succeed)
      const loginResponse2 = await request(app)
        .post('/signin')
        .send(signupData);

      expect(loginResponse2.status).toBe(200);
      expect(loginResponse2.body.message).toBe('Login successful');

      const cookies = loginResponse2.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const jwtCookie = cookies.find(cookie => cookie.startsWith('jwt='));
      expect(jwtCookie).toBeDefined();

      // Step 6: Create profile
      const profileData = {
        name: 'Test User',
        age: 25,
        gender: 'female',
        sexualOrientation: 'straight',
        profession: 'Software Engineer',
        bio: 'Test bio',
        interests: ['coding', 'hiking'],
        convoStarter: 'What is your favorite programming language?'
      };

      const profileResponse = await request(app)
        .post('/profile')
        .set('Cookie', jwtCookie)
        .send(profileData);

      expect(profileResponse.status).toBe(201);
      expect(profileResponse.body.name).toBe(profileData.name);
      expect(profileResponse.body.owner).toBe(verifiedUser._id.toString());

      // Step 7: Get profile
      const getProfileResponse = await request(app)
        .get('/profile')
        .set('Cookie', jwtCookie);

      expect(getProfileResponse.status).toBe(200);
      expect(getProfileResponse.body.name).toBe(profileData.name);
    });

    test('should reject invalid verification token', async () => {
      const response = await request(app)
        .post('/email-verification/verify')
        .send({ token: 'invalid_token_123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid or expired');
    });

    test('should reject expired verification token', async () => {
      // Create user
      const user = await User.create({
        email: 'test@example.com',
        password: await require('bcryptjs').hash('TestPass123!', 10),
        isEmailVerified: false
      });

      // Create expired verification token
      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      await EmailVerification.create({
        userId: user._id,
        token: hashedToken,
        expiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
      });

      const response = await request(app)
        .post('/email-verification/verify')
        .send({ token });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid or expired');
    });

    test('should allow resending verification email', async () => {
      // Create unverified user
      const userData = {
        email: 'test@example.com',
        password: 'TestPass123!'
      };

      await request(app).post('/signup').send(userData);

      sendVerificationEmail.mockClear();

      // Resend verification
      const response = await request(app)
        .post('/email-verification/send')
        .send({ email: userData.email });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Verification email sent');
      expect(sendVerificationEmail).toHaveBeenCalledTimes(1);

      // Old token should be deleted, new one created
      const user = await User.findOne({ email: userData.email });
      const verificationDocs = await EmailVerification.find({ userId: user._id });
      expect(verificationDocs.length).toBe(1);
    });

    test('should reject resend for already verified email', async () => {
      const user = await User.create({
        email: 'verified@example.com',
        password: await require('bcryptjs').hash('TestPass123!', 10),
        isEmailVerified: true
      });

      const response = await request(app)
        .post('/email-verification/send')
        .send({ email: user.email });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email is already verified');
    });
  });

  describe('Login Security', () => {
    test('should reject login with incorrect password', async () => {
      const user = await User.create({
        email: 'test@example.com',
        password: await require('bcryptjs').hash('CorrectPass123!', 10),
        isEmailVerified: true
      });

      const response = await request(app)
        .post('/signin')
        .send({
          email: 'test@example.com',
          password: 'WrongPass123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Incorrect password or email');
    });

    test('should reject login for non-existent user', async () => {
      const response = await request(app)
        .post('/signin')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePass123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Incorrect password or email');
    });

    test('should reject login for Google OAuth user without password', async () => {
      const user = await User.create({
        email: 'googleuser@example.com',
        googleId: '123456789',
        isEmailVerified: true
      });

      const response = await request(app)
        .post('/signin')
        .send({
          email: 'googleuser@example.com',
          password: 'SomePass123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('sign in with Google');
    });
  });

  describe('Protected Route Access', () => {
    test('should require authentication for profile creation', async () => {
      const profileData = {
        name: 'Test User',
        age: 25,
        gender: 'male',
        sexualOrientation: 'straight',
        interests: ['coding']
      };

      const response = await request(app)
        .post('/profile')
        .send(profileData);

      expect(response.status).toBe(401);
    });

    test('should reject invalid JWT token', async () => {
      const profileData = {
        name: 'Test User',
        age: 25,
        gender: 'male',
        sexualOrientation: 'straight',
        interests: ['coding']
      };

      const response = await request(app)
        .post('/profile')
        .set('Cookie', 'jwt=invalid_token_here')
        .send(profileData);

      expect(response.status).toBe(401);
    });
  });

  describe('Session Management', () => {
    test('should logout successfully', async () => {
      // Create and login user
      const userData = {
        email: 'test@example.com',
        password: 'TestPass123!'
      };

      await User.create({
        email: userData.email,
        password: await require('bcryptjs').hash(userData.password, 10),
        isEmailVerified: true
      });

      const loginResponse = await request(app)
        .post('/signin')
        .send(userData);

      const jwtCookie = loginResponse.headers['set-cookie'].find(c => c.startsWith('jwt='));

      // Logout
      const logoutResponse = await request(app)
        .post('/logout')
        .set('Cookie', jwtCookie);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.message).toBe('Logout successful');

      // Verify cookie is cleared
      const setCookieHeader = logoutResponse.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      const clearedCookie = setCookieHeader.find(c => c.startsWith('jwt='));
      expect(clearedCookie).toContain('Max-Age=0'); // Cookie should be expired
    });
  });
});

describe('Password Security', () => {
  test('should hash passwords before storing', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'PlainTextPassword123!'
    };

    await request(app).post('/signup').send(userData);

    const user = await User.findOne({ email: userData.email }).select('+password');

    // Password should be hashed, not plain text
    expect(user.password).not.toBe(userData.password);
    expect(user.password).toMatch(/^\$2[aby]\$/); // bcrypt hash pattern
  });

  test('should enforce password requirements', async () => {
    const weakPasswords = [
      'short', // Too short
      'nouppercase123!', // No uppercase
      'NOLOWERCASE123!', // No lowercase
      'NoNumbers!', // No numbers
      'NoSpecial123', // No special characters
    ];

    for (const password of weakPasswords) {
      const response = await request(app)
        .post('/signup')
        .send({
          email: 'test@example.com',
          password
        });

      expect(response.status).toBe(400);
    }
  });
});
