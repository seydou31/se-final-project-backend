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
const CuratedEvent = require('../models/curatedEvent');
const curatedEventsRouter = require('../routes/curatedEvents');
const SECRET = require('../utils/config');

// Washington DC coordinates
const EVENT_LAT = 38.9072;
const EVENT_LNG = -77.0369;
// ~0.38 km from event — within 1 mile
const NEARBY_LAT = 38.9100;
const NEARBY_LNG = -77.0395;
// ~21 km from event — well beyond 1 mile
const FAR_LAT = 39.1;
const FAR_LNG = -77.0;

let mongoServer;
let app;
let server;
let io;

beforeAll(async () => {
  process.env.EVENT_CREATION_PASSPHRASE = 'test-passphrase';
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  // Ensure 2dsphere index is ready before geo queries run
  await CuratedEvent.createIndexes();

  app = express();
  server = http.createServer(app);
  io = new Server(server);
  app.set('io', io);

  app.use(express.json());
  app.use(cookieParser());
  app.use('/events', curatedEventsRouter);

  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ message: err.message || 'An error occurred' });
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
  await CuratedEvent.deleteMany({});
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createUserAndToken(email = 'test@example.com') {
  const userDoc = await User.create({
    email,
    password: await bcrypt.hash('TestPass1!', 10),
  });
  const token = jwt.sign({ _id: userDoc._id, tokenVersion: userDoc.tokenVersion }, SECRET.JWT_SECRET);
  return { user: userDoc, token };
}

async function createTestEvent(overrides = {}) {
  return CuratedEvent.create({
    name: 'Test Event',
    address: '1600 Pennsylvania Ave NW, Washington, DC',
    location: {
      type: 'Point',
      coordinates: [EVENT_LNG, EVENT_LAT], // GeoJSON: [lng, lat]
    },
    startTime: new Date(Date.now() - 60 * 60 * 1000),      // started 1 h ago
    endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),    // ends in 3 h
    ...overrides,
  });
}

async function createTestProfile(userId, overrides = {}) {
  return Profile.create({
    name: 'Test User',
    age: 25,
    gender: 'male',
    sexualOrientation: 'straight',
    profession: 'Engineer',
    bio: 'Test bio here',
    interests: ['gaming'],
    convoStarter: 'Hello there!',
    phoneNumber: '+12025551234',
    owner: userId,
    ...overrides,
  });
}

// ─── POST /events — createEvent (public) ─────────────────────────────────────

describe('POST /events — createEvent (public)', () => {
  it('should create an event when lat/lng are provided directly', async () => {
    const res = await request(app)
      .post('/events')
      .set('x-event-passphrase', 'test-passphrase')
      .send({
        name: 'New Event',
        address: '1600 Pennsylvania Ave NW',
        lat: EVENT_LAT,
        lng: EVENT_LNG,
        startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.event.name).toBe('New Event');
    expect(res.body.event.address).toBe('1600 Pennsylvania Ave NW');
    expect(res.body.event.location.coordinates).toEqual([EVENT_LNG, EVENT_LAT]);
  });

  it('should store optional fields when provided', async () => {
    const res = await request(app)
      .post('/events')
      .set('x-event-passphrase', 'test-passphrase')
      .send({
        name: 'Full Event',
        address: '123 Main St',
        city: 'Washington',
        state: 'DC',
        zipcode: '20500',
        description: 'A great event',
        lat: EVENT_LAT,
        lng: EVENT_LNG,
        startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.event.city).toBe('Washington');
    expect(res.body.event.state).toBe('DC');
    expect(res.body.event.description).toBe('A great event');
  });

  it('should return 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/events')
      .set('x-event-passphrase', 'test-passphrase')
      .send({ name: 'Incomplete Event' }); // missing address, startTime, endTime

    expect(res.status).toBe(400);
  });

  it('should return 400 when end time is before start time', async () => {
    const res = await request(app)
      .post('/events')
      .set('x-event-passphrase', 'test-passphrase')
      .send({
        name: 'Bad Timing',
        address: '123 Main St',
        lat: EVENT_LAT,
        lng: EVENT_LNG,
        startTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // before start
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/end time must be after start time/i);
  });
});

// ─── GET /events/nearby — getNearbyEvents (public) ───────────────────────────

describe('GET /events/nearby — getNearbyEvents (public)', () => {
  it('should return currently-active events within the radius', async () => {
    await createTestEvent();

    const res = await request(app)
      .get('/events/nearby')
      .query({ lat: EVENT_LAT, lng: EVENT_LNG, radiusKm: 5 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Test Event');
    expect(res.body[0].isCurated).toBe(true);
  });

  it('should not return events outside the radius', async () => {
    await CuratedEvent.create({
      name: 'Far Away Event',
      address: 'Far away',
      location: { type: 'Point', coordinates: [FAR_LNG, FAR_LAT] },
      startTime: new Date(Date.now() - 60 * 60 * 1000),
      endTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .get('/events/nearby')
      .query({ lat: EVENT_LAT, lng: EVENT_LNG, radiusKm: 5 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('should not return events that have already ended', async () => {
    await createTestEvent({
      startTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .get('/events/nearby')
      .query({ lat: EVENT_LAT, lng: EVENT_LNG, radiusKm: 5 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('should return 400 when lat/lng are omitted', async () => {
    const res = await request(app).get('/events/nearby');

    expect(res.status).toBe(400);
  });
});

// ─── GET /events — getEvents (auth required) ─────────────────────────────────

describe('GET /events — getEvents (auth required)', () => {
  let token;
  let userId;

  beforeEach(async () => {
    const result = await createUserAndToken();
    userId = result.user._id;
    token = result.token;
  });

  it('should return active events with goingCount, checkedInCount, isUserGoing', async () => {
    await createTestEvent();

    const res = await request(app)
      .get('/events')
      .set('Cookie', [`jwt=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Test Event');
    expect(res.body[0]).toHaveProperty('goingCount', 0);
    expect(res.body[0]).toHaveProperty('checkedInCount', 0);
    expect(res.body[0]).toHaveProperty('isUserGoing', false);
  });

  it('should not include expired events', async () => {
    await createTestEvent({
      startTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .get('/events')
      .set('Cookie', [`jwt=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('should set isUserGoing=true when the requesting user has RSVP\'d', async () => {
    const evt = await createTestEvent();
    evt.usersGoing.push(userId);
    await evt.save();

    const res = await request(app)
      .get('/events')
      .set('Cookie', [`jwt=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body[0].isUserGoing).toBe(true);
    expect(res.body[0].goingCount).toBe(1);
  });

  it('should return 401 without a valid token', async () => {
    const res = await request(app).get('/events');

    expect(res.status).toBe(401);
  });
});

// ─── POST /events/:id/going — markAsGoing (toggle) ───────────────────────────

describe('POST /events/:id/going — markAsGoing (toggle)', () => {
  let token;
  let userId;
  let testEvent;

  beforeEach(async () => {
    const result = await createUserAndToken();
    userId = result.user._id;
    token = result.token;
    testEvent = await createTestEvent();
  });

  it('should add the user and return isGoing=true', async () => {
    const res = await request(app)
      .post(`/events/${testEvent._id}/going`)
      .set('Cookie', [`jwt=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.isGoing).toBe(true);
    expect(res.body.goingCount).toBe(1);

    const updated = await CuratedEvent.findById(testEvent._id);
    expect(updated.usersGoing.map(id => id.toString())).toContain(userId.toString());
  });

  it('should toggle off and return isGoing=false when user is already going', async () => {
    testEvent.usersGoing.push(userId);
    await testEvent.save();

    const res = await request(app)
      .post(`/events/${testEvent._id}/going`)
      .set('Cookie', [`jwt=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.isGoing).toBe(false);
    expect(res.body.goingCount).toBe(0);

    const updated = await CuratedEvent.findById(testEvent._id);
    expect(updated.usersGoing).toHaveLength(0);
  });

  it('should return 404 for a non-existent event', async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post(`/events/${fakeId}/going`)
      .set('Cookie', [`jwt=${token}`]);

    expect(res.status).toBe(404);
  });

  it('should return 401 without a valid token', async () => {
    const res = await request(app).post(`/events/${testEvent._id}/going`);

    expect(res.status).toBe(401);
  });
});

// ─── POST /events/:id/checkin — checkinAtEvent ───────────────────────────────

describe('POST /events/:id/checkin — checkinAtEvent', () => {
  let token;
  let userId;
  let testEvent;

  beforeEach(async () => {
    const result = await createUserAndToken();
    userId = result.user._id;
    token = result.token;
    testEvent = await createTestEvent();
    await createTestProfile(userId);
  });

  it('should check in when within 1 mile and return compatible users list', async () => {
    const res = await request(app)
      .post(`/events/${testEvent._id}/checkin`)
      .set('Cookie', [`jwt=${token}`])
      .send({ lat: NEARBY_LAT, lng: NEARBY_LNG });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Checked in successfully');
    expect(Array.isArray(res.body.users)).toBe(true);

    const updated = await CuratedEvent.findById(testEvent._id);
    expect(updated.checkedInUsers.map(id => id.toString())).toContain(userId.toString());
  });

  it('should return 400 when user is more than 1 mile away', async () => {
    const res = await request(app)
      .post(`/events/${testEvent._id}/checkin`)
      .set('Cookie', [`jwt=${token}`])
      .send({ lat: FAR_LAT, lng: FAR_LNG });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/1 mile/i);
  });

  it('should return 400 when coordinates are missing', async () => {
    const res = await request(app)
      .post(`/events/${testEvent._id}/checkin`)
      .set('Cookie', [`jwt=${token}`])
      .send({});

    expect(res.status).toBe(400);
  });

  it('should return 400 when the event has already ended', async () => {
    const pastEvent = await createTestEvent({
      startTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .post(`/events/${pastEvent._id}/checkin`)
      .set('Cookie', [`jwt=${token}`])
      .send({ lat: NEARBY_LAT, lng: NEARBY_LNG });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/ended/i);
  });

  it('should not add the same user to checkedInUsers more than once', async () => {
    await request(app)
      .post(`/events/${testEvent._id}/checkin`)
      .set('Cookie', [`jwt=${token}`])
      .send({ lat: NEARBY_LAT, lng: NEARBY_LNG });

    await request(app)
      .post(`/events/${testEvent._id}/checkin`)
      .set('Cookie', [`jwt=${token}`])
      .send({ lat: NEARBY_LAT, lng: NEARBY_LNG });

    const updated = await CuratedEvent.findById(testEvent._id);
    expect(updated.checkedInUsers).toHaveLength(1);
  });

  it('should return 404 for a non-existent event', async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post(`/events/${fakeId}/checkin`)
      .set('Cookie', [`jwt=${token}`])
      .send({ lat: NEARBY_LAT, lng: NEARBY_LNG });

    expect(res.status).toBe(404);
  });

  it('should return 401 without a valid token', async () => {
    const res = await request(app)
      .post(`/events/${testEvent._id}/checkin`)
      .send({ lat: NEARBY_LAT, lng: NEARBY_LNG });

    expect(res.status).toBe(401);
  });
});

// ─── POST /events/:id/checkout — checkoutFromEvent ───────────────────────────

describe('POST /events/:id/checkout — checkoutFromEvent', () => {
  let token;
  let userId;
  let testEvent;

  beforeEach(async () => {
    const result = await createUserAndToken();
    userId = result.user._id;
    token = result.token;
    testEvent = await createTestEvent();
    testEvent.checkedInUsers.push(userId);
    await testEvent.save();
    await createTestProfile(userId, {
      location: { lat: NEARBY_LAT, lng: NEARBY_LNG, eventId: testEvent._id, updatedAt: new Date() },
    });
  });

  it('should check out successfully', async () => {
    const res = await request(app)
      .post(`/events/${testEvent._id}/checkout`)
      .set('Cookie', [`jwt=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Checked out successfully');
  });

  it('should remove the user from checkedInUsers', async () => {
    await request(app)
      .post(`/events/${testEvent._id}/checkout`)
      .set('Cookie', [`jwt=${token}`]);

    const updated = await CuratedEvent.findById(testEvent._id);
    expect(updated.checkedInUsers.map(id => id.toString())).not.toContain(userId.toString());
  });

  it('should return 404 for a non-existent event', async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .post(`/events/${fakeId}/checkout`)
      .set('Cookie', [`jwt=${token}`]);

    expect(res.status).toBe(404);
  });

  it('should return 401 without a valid token', async () => {
    const res = await request(app).post(`/events/${testEvent._id}/checkout`);

    expect(res.status).toBe(401);
  });
});

// ─── GET /events/:id/users — getUsersAtEvent ─────────────────────────────────

describe('GET /events/:id/users — getUsersAtEvent', () => {
  let token;
  let userId;
  let testEvent;

  beforeEach(async () => {
    const result = await createUserAndToken();
    userId = result.user._id;
    token = result.token;
    testEvent = await createTestEvent();
    // Requesting user: straight male
    await createTestProfile(userId, { gender: 'male', sexualOrientation: 'straight' });
  });

  it('should return compatible checked-in users (straight female for straight male)', async () => {
    const { user: otherUser } = await createUserAndToken('jane@example.com');
    await createTestProfile(otherUser._id, {
      name: 'Jane',
      gender: 'female',
      sexualOrientation: 'straight',
    });
    testEvent.checkedInUsers.push(otherUser._id);
    await testEvent.save();

    const res = await request(app)
      .get(`/events/${testEvent._id}/users`)
      .set('Cookie', [`jwt=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Jane');
  });

  it('should not return users filtered out by gender preference', async () => {
    // Straight male requestor → only fetches female profiles; Bob is male → excluded
    const { user: otherUser } = await createUserAndToken('bob@example.com');
    await createTestProfile(otherUser._id, {
      name: 'Bob',
      gender: 'male',
      sexualOrientation: 'straight',
    });
    testEvent.checkedInUsers.push(otherUser._id);
    await testEvent.save();

    const res = await request(app)
      .get(`/events/${testEvent._id}/users`)
      .set('Cookie', [`jwt=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('should not return the requesting user themselves', async () => {
    testEvent.checkedInUsers.push(userId);
    await testEvent.save();

    const res = await request(app)
      .get(`/events/${testEvent._id}/users`)
      .set('Cookie', [`jwt=${token}`]);

    expect(res.status).toBe(200);
    // Requesting user is the only one checked in but is excluded by the DB query
    expect(res.body).toHaveLength(0);
  });

  it('should return 404 for a non-existent event', async () => {
    const fakeId = new mongoose.Types.ObjectId();

    const res = await request(app)
      .get(`/events/${fakeId}/users`)
      .set('Cookie', [`jwt=${token}`]);

    expect(res.status).toBe(404);
  });

  it('should return 404 when the requesting user has no profile', async () => {
    await Profile.deleteMany({});

    const res = await request(app)
      .get(`/events/${testEvent._id}/users`)
      .set('Cookie', [`jwt=${token}`]);

    expect(res.status).toBe(404);
  });

  it('should return 401 without a valid token', async () => {
    const res = await request(app).get(`/events/${testEvent._id}/users`);

    expect(res.status).toBe(401);
  });
});
