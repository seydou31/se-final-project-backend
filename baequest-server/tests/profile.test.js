const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Profile = require('../models/profile');
const profileController = require('../controllers/profile');
const SECRET = require('../utils/config');

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

  // Setup routes
  app.post('/users/profile', require('../middleware/auth'), profileController.createProfile);
  app.get('/users/profile', require('../middleware/auth'), profileController.getProfile);
  app.patch('/users/profile', require('../middleware/auth'), profileController.updateProfile);
  app.delete('/users/profile', require('../middleware/auth'), profileController.deleteProfile);

  // Error handler
  app.use((err, req, res, next) => {
    const status = err.statusCode || 500;
    const message = err.message || 'An error occurred';
    res.status(status).json({ message });
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await Profile.deleteMany({});
});

describe('Profile Endpoints', () => {
  let token;
  let userId;

  beforeEach(async () => {
    const user = await User.create({
      email: 'test@example.com',
      password: await bcrypt.hash('password123', 10),
    });
    userId = user._id;
    token = jwt.sign({ _id: userId }, SECRET.JWT_SECRET);
  });

  describe('POST /users/profile', () => {
    it('should create a new profile', async () => {
      const profileData = {
        name: 'John Doe',
        age: 25,
        gender: 'male',
        sexualOrientation: 'straight',
        profession: 'Engineer',
        bio: 'I love coding',
        interests: ['gaming', 'hiking', 'coffee'],
        convoStarter: 'What do you do for fun?',
      };

      const res = await request(app)
        .post('/users/profile')
        .set('Cookie', [`jwt=${token}`])
        .send(profileData);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'John Doe',
        age: 25,
        gender: 'male',
        profession: 'Engineer',
      });
      expect(res.body).toHaveProperty('owner');
      expect(res.body.owner.toString()).toBe(userId.toString());
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/users/profile')
        .send({
          name: 'John Doe',
          age: 25,
        });

      expect(res.status).toBe(401);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/users/profile')
        .set('Cookie', [`jwt=${token}`])
        .send({
          name: 'John Doe',
          // Missing required fields
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should validate age minimum (18)', async () => {
      const res = await request(app)
        .post('/users/profile')
        .set('Cookie', [`jwt=${token}`])
        .send({
          name: 'John Doe',
          age: 17,
          gender: 'male',
          sexualOrientation: 'straight',
          profession: 'Student',
          bio: 'Too young',
          interests: ['gaming'],
          convoStarter: 'Hello',
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should validate interests array length (max 3)', async () => {
      const res = await request(app)
        .post('/users/profile')
        .set('Cookie', [`jwt=${token}`])
        .send({
          name: 'John Doe',
          age: 25,
          gender: 'male',
          sexualOrientation: 'straight',
          profession: 'Engineer',
          bio: 'Love many things',
          interests: ['gaming', 'hiking', 'coffee', 'gaming'], // 4 interests
          convoStarter: 'What do you do?',
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should save all interests correctly', async () => {
      const res = await request(app)
        .post('/users/profile')
        .set('Cookie', [`jwt=${token}`])
        .send({
          name: 'Jane Smith',
          age: 28,
          gender: 'female',
          sexualOrientation: 'bisexual',
          profession: 'Designer',
          bio: 'Creative soul',
          interests: ['art', 'gaming', 'travel'],
          convoStarter: 'Favorite travel destination?',
        });

      expect(res.status).toBe(201);
      expect(res.body.interests).toEqual(['art', 'gaming', 'travel']);
    });
  });

  describe('GET /users/profile', () => {
    beforeEach(async () => {
      await Profile.create({
        name: 'John Doe',
        age: 25,
        gender: 'male',
        sexualOrientation: 'straight',
        profession: 'Engineer',
        bio: 'I love coding',
        interests: ['gaming', 'hiking'],
        convoStarter: 'What do you do?',
        owner: userId,
      });
    });

    it('should get user profile', async () => {
      const res = await request(app)
        .get('/users/profile')
        .set('Cookie', [`jwt=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        name: 'John Doe',
        age: 25,
        gender: 'male',
        profession: 'Engineer',
      });
    });

    it('should return 404 if profile does not exist', async () => {
      await Profile.deleteMany({});

      const res = await request(app)
        .get('/users/profile')
        .set('Cookie', [`jwt=${token}`]);

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/users/profile');

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /users/profile', () => {
    beforeEach(async () => {
      await Profile.create({
        name: 'John Doe',
        age: 25,
        gender: 'male',
        sexualOrientation: 'straight',
        profession: 'Engineer',
        bio: 'I love coding',
        interests: ['gaming', 'hiking'],
        convoStarter: 'What do you do?',
        owner: userId,
      });
    });

    it('should update profile fields', async () => {
      const res = await request(app)
        .patch('/users/profile')
        .set('Cookie', [`jwt=${token}`])
        .send({
          name: 'John Smith',
          age: 26,
          gender: 'male',
          sexualOrientation: 'straight',
          profession: 'Senior Engineer',
          bio: 'I love coding and teaching',
          interests: ['gaming', 'travel', 'coffee'],
          convoStarter: 'What are you working on?',
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('John Smith');
      expect(res.body.age).toBe(26);
      expect(res.body.profession).toBe('Senior Engineer');
      expect(res.body.interests).toEqual(['gaming', 'travel', 'coffee']);
    });

    it('should update only provided fields', async () => {
      const res = await request(app)
        .patch('/users/profile')
        .set('Cookie', [`jwt=${token}`])
        .send({
          name: 'John Doe',
          age: 26,
          gender: 'male',
          sexualOrientation: 'straight',
          profession: 'Senior Engineer',
          bio: 'I love coding',
          interests: ['gaming', 'hiking'],
          convoStarter: 'What do you do?',
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('John Doe');
      expect(res.body.profession).toBe('Senior Engineer');
    });

    it('should validate updated fields', async () => {
      const res = await request(app)
        .patch('/users/profile')
        .set('Cookie', [`jwt=${token}`])
        .send({
          name: 'John Doe',
          age: 15, // Invalid age
          gender: 'male',
          sexualOrientation: 'straight',
          profession: 'Student',
          bio: 'Too young',
          interests: ['gaming'],
          convoStarter: 'Hello',
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should return 404 if profile does not exist', async () => {
      await Profile.deleteMany({});

      const res = await request(app)
        .patch('/users/profile')
        .set('Cookie', [`jwt=${token}`])
        .send({
          name: 'John Smith',
          age: 26,
          gender: 'male',
          sexualOrientation: 'straight',
          profession: 'Engineer',
          bio: 'Test',
          interests: ['gaming'],
          convoStarter: 'Hi',
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .patch('/users/profile')
        .send({
          profession: 'Senior Engineer',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /users/profile', () => {
    beforeEach(async () => {
      await Profile.create({
        name: 'John Doe',
        age: 25,
        gender: 'male',
        sexualOrientation: 'straight',
        profession: 'Engineer',
        bio: 'I love coding',
        interests: ['gaming', 'hiking'],
        convoStarter: 'What do you do?',
        owner: userId,
      });
    });

    it('should delete user profile', async () => {
      const res = await request(app)
        .delete('/users/profile')
        .set('Cookie', [`jwt=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('profile deleted successfully');

      const profile = await Profile.findOne({ owner: userId });
      expect(profile).toBeNull();
    });

    it('should return 404 if profile does not exist', async () => {
      await Profile.deleteMany({});

      const res = await request(app)
        .delete('/users/profile')
        .set('Cookie', [`jwt=${token}`]);

      expect(res.status).toBe(404);
    });

    it('should require authentication', async () => {
      const res = await request(app).delete('/users/profile');

      expect(res.status).toBe(401);
    });
  });
});

describe('Profile Validation', () => {
  it('should enforce valid gender values', async () => {
    const user = await User.create({
      email: 'test@example.com',
      password: await bcrypt.hash('password123', 10),
    });
    const token = jwt.sign({ _id: user._id }, SECRET.JWT_SECRET);

    const res = await request(app)
      .post('/users/profile')
      .set('Cookie', [`jwt=${token}`])
      .send({
        name: 'Test User',
        age: 25,
        gender: 'invalid',
        sexualOrientation: 'straight',
        profession: 'Engineer',
        bio: 'Testing',
        interests: ['gaming'],
        convoStarter: 'Hello',
      });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('should enforce valid sexual orientation values', async () => {
    const user = await User.create({
      email: 'test@example.com',
      password: await bcrypt.hash('password123', 10),
    });
    const token = jwt.sign({ _id: user._id }, SECRET.JWT_SECRET);

    const res = await request(app)
      .post('/users/profile')
      .set('Cookie', [`jwt=${token}`])
      .send({
        name: 'Test User',
        age: 25,
        gender: 'male',
        sexualOrientation: 'invalid',
        profession: 'Engineer',
        bio: 'Testing',
        interests: ['gaming'],
        convoStarter: 'Hello',
      });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
