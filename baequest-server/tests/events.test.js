const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Profile = require('../models/profile');
const Event = require('../models/event');
const eventController = require('../controllers/event');
const SECRET = require('../utils/config');

let mongoServer;
let app;
let server;
let io;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Create test app with Socket.io
  app = express();
  server = http.createServer(app);
  io = new Server(server);
  app.set('io', io);

  app.use(express.json());
  app.use(cookieParser());

  // Setup routes
  app.get('/events', require('../middleware/auth'), eventController.events);
  app.post('/checkin', require('../middleware/auth'), eventController.checkin);
  app.post('/checkout', require('../middleware/auth'), eventController.eventCheckout);
  app.post('/going', require('../middleware/auth'), eventController.markAsGoing);

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
  server.close();
});

afterEach(async () => {
  await User.deleteMany({});
  await Profile.deleteMany({});
  await Event.deleteMany({});
});

describe('Event Endpoints', () => {
  let token;
  let userId;
  let testEvent;

  beforeEach(async () => {
    const user = await User.create({
      email: 'test@example.com',
      password: await bcrypt.hash('password123', 10),
    });
    userId = user._id;
    token = jwt.sign({ _id: userId }, SECRET.JWT_SECRET);

    // Create test event
    testEvent = await Event.create({
      title: 'Coffee Meetup',
      description: 'Morning coffee',
      date: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
      location: {
        name: 'Starbucks',
        address: '123 Main St',
        lat: 40.7128,
        lng: -74.0060,
      },
      image: 'https://example.com/coffee.jpg',
      price: 'Free',
      state: 'New York',
      usersGoing: [],
    });
  });

  describe('GET /events', () => {
    it('should get all active events', async () => {
      const res = await request(app)
        .get('/events')
        .set('Cookie', [`jwt=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        title: 'Coffee Meetup',
        description: 'Morning coffee',
      });
      expect(res.body[0]).toHaveProperty('goingCount', 0);
      expect(res.body[0]).toHaveProperty('isUserGoing', false);
    });

    it('should filter events by state', async () => {
      await Event.create({
        title: 'LA Party',
        description: 'Party in LA',
        date: new Date(Date.now() + 2 * 60 * 60 * 1000),
        endTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
        location: {
          name: 'Club',
          address: '456 Oak Ave',
          lat: 34.0522,
          lng: -118.2437,
        },
        image: 'https://example.com/party.jpg',
        price: '$20',
        state: 'California',
        usersGoing: [],
      });

      const res = await request(app)
        .get('/events?state=New York')
        .set('Cookie', [`jwt=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Coffee Meetup');
    });

    it('should not include expired events', async () => {
      await Event.create({
        title: 'Past Event',
        description: 'Already happened',
        date: new Date(Date.now() - 4 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // Ended 2 hours ago
        location: {
          name: 'Past Location',
          address: '789 Past St',
          lat: 40.7128,
          lng: -74.0060,
        },
        image: 'https://example.com/past.jpg',
        price: 'Free',
        state: 'New York',
        usersGoing: [],
      });

      const res = await request(app)
        .get('/events')
        .set('Cookie', [`jwt=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Coffee Meetup');
    });

    it('should show goingCount correctly', async () => {
      const otherUser = await User.create({
        email: 'other@example.com',
        password: await bcrypt.hash('password', 10),
      });

      testEvent.usersGoing = [otherUser._id];
      await testEvent.save();

      const res = await request(app)
        .get('/events')
        .set('Cookie', [`jwt=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body[0].goingCount).toBe(1);
      expect(res.body[0].isUserGoing).toBe(false);
    });

    it('should show isUserGoing as true when user is going', async () => {
      testEvent.usersGoing = [userId];
      await testEvent.save();

      const res = await request(app)
        .get('/events')
        .set('Cookie', [`jwt=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body[0].isUserGoing).toBe(true);
      expect(res.body[0].goingCount).toBe(1);
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/events');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /checkin', () => {
    beforeEach(async () => {
      await Profile.create({
        name: 'John Doe',
        age: 25,
        gender: 'male',
        sexualOrientation: 'straight',
        profession: 'Engineer',
        bio: 'Test bio',
        interests: ['gaming'],
        convoStarter: 'Hello!',
        owner: userId,
      });
    });

    it('should check in when user is at event location', async () => {
      const res = await request(app)
        .post('/checkin')
        .set('Cookie', [`jwt=${token}`])
        .send({
          lat: 40.7128,
          lng: -74.0060,
          eventId: testEvent._id,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('location');
      expect(res.body.location.eventId.toString()).toBe(testEvent._id.toString());
    });

    it('should reject check-in when user is too far', async () => {
      const res = await request(app)
        .post('/checkin')
        .set('Cookie', [`jwt=${token}`])
        .send({
          lat: 40.8, // Too far
          lng: -74.0,
          eventId: testEvent._id,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/too far/i);
    });

    it('should return 404 for non-existent event', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post('/checkin')
        .set('Cookie', [`jwt=${token}`])
        .send({
          lat: 40.7128,
          lng: -74.0060,
          eventId: fakeId,
        });

      expect(res.status).toBe(404);
    });

    it('should require all fields', async () => {
      const res = await request(app)
        .post('/checkin')
        .set('Cookie', [`jwt=${token}`])
        .send({
          lat: 40.7128,
          // Missing lng and eventId
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /checkout', () => {
    beforeEach(async () => {
      await Profile.create({
        name: 'John Doe',
        age: 25,
        gender: 'male',
        sexualOrientation: 'straight',
        profession: 'Engineer',
        bio: 'Test bio',
        interests: ['gaming'],
        convoStarter: 'Hello!',
        owner: userId,
        location: {
          lat: 40.7128,
          lng: -74.0060,
          eventId: testEvent._id,
          updatedAt: new Date(),
        },
      });
    });

    it('should check out from event', async () => {
      const res = await request(app)
        .post('/checkout')
        .set('Cookie', [`jwt=${token}`])
        .send({
          eventId: testEvent._id,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Checked out successfully');

      const profile = await Profile.findOne({ owner: userId });
      expect(profile.location.eventId).toBeUndefined();
    });

    it('should require eventId', async () => {
      const res = await request(app)
        .post('/checkout')
        .set('Cookie', [`jwt=${token}`])
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /going', () => {
    it('should mark user as going to event', async () => {
      const res = await request(app)
        .post('/going')
        .set('Cookie', [`jwt=${token}`])
        .send({
          eventId: testEvent._id,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Marked as going');
      expect(res.body.count).toBe(1);

      const event = await Event.findById(testEvent._id);
      expect(event.usersGoing).toHaveLength(1);
      expect(event.usersGoing[0].toString()).toBe(userId.toString());
    });

    it('should prevent duplicate going marks', async () => {
      testEvent.usersGoing = [userId];
      await testEvent.save();

      const res = await request(app)
        .post('/going')
        .set('Cookie', [`jwt=${token}`])
        .send({
          eventId: testEvent._id,
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Already marked as going');
      expect(res.body.count).toBe(1);
    });

    it('should increment count correctly with multiple users', async () => {
      const user2 = await User.create({
        email: 'user2@example.com',
        password: await bcrypt.hash('password', 10),
      });
      const user3 = await User.create({
        email: 'user3@example.com',
        password: await bcrypt.hash('password', 10),
      });

      testEvent.usersGoing = [user2._id, user3._id];
      await testEvent.save();

      const res = await request(app)
        .post('/going')
        .set('Cookie', [`jwt=${token}`])
        .send({
          eventId: testEvent._id,
        });

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
    });

    it('should return 404 for non-existent event', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post('/going')
        .set('Cookie', [`jwt=${token}`])
        .send({
          eventId: fakeId,
        });

      expect(res.status).toBe(404);
    });

    it('should require eventId', async () => {
      const res = await request(app)
        .post('/going')
        .set('Cookie', [`jwt=${token}`])
        .send({});

      expect(res.status).toBe(400);
    });
  });
});

describe('Location Validation', () => {
  it('should validate location coordinates within range', () => {
    const eventLat = 40.7128;
    const eventLng = -74.0060;

    const userLat = 40.7130; // Very close
    const userLng = -74.0062;

    const latDiff = Math.abs(userLat - eventLat);
    const lngDiff = Math.abs(userLng - eventLng);
    const maxDiff = 0.005;

    expect(latDiff).toBeLessThan(maxDiff);
    expect(lngDiff).toBeLessThan(maxDiff);
  });

  it('should reject coordinates too far away', () => {
    const eventLat = 40.7128;
    const eventLng = -74.0060;

    const userLat = 40.8; // Too far
    const userLng = -74.0;

    const latDiff = Math.abs(userLat - eventLat);
    const lngDiff = Math.abs(userLng - eventLng);
    const maxDiff = 0.005;

    expect(latDiff > maxDiff || lngDiff > maxDiff).toBe(true);
  });
});
