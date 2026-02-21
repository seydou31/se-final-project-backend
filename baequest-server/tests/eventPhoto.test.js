// Tests for createEvent photo upload path in controllers/curatedEvents.js
// uploadEventPhoto (lines 46-72) is not covered by events.test.js because
// all existing tests send JSON without a file. This file covers both paths.

// Local disk path (isS3Configured = false)
jest.mock('../middleware/multer', () => ({
  isS3Configured: false,
  single: () => (req, res, next) => next(), // no-op for route middleware
}));

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      // Preserve all real promise-based methods (stat, readFile, etc.) so that
      // mongodb-memory-server and other transitive deps continue to work.
      ...actualFs.promises,
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
    },
  };
});

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const CuratedEvent = require('../models/curatedEvent');
const curatedEventsController = require('../controllers/curatedEvents');

const EVENT_LAT = 38.9072;
const EVENT_LNG = -77.0369;

let mongoServer;
let app;
let server;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await CuratedEvent.createIndexes();

  app = express();
  app.use(express.json());

  server = http.createServer(app);
  const io = new Server(server);
  app.set('io', io);

  // Inject req.file to simulate multer file upload
  app.post('/events', (req, res, next) => {
    req.file = {
      buffer: Buffer.from('fake-image'),
      originalname: 'event.jpg',
      mimetype: 'image/jpeg',
    };
    next();
  }, curatedEventsController.createEvent);

  // Route without file — to confirm photo is optional
  app.post('/events-no-photo', curatedEventsController.createEvent);

  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ message: err.message });
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  server.close();
});

afterEach(async () => {
  await CuratedEvent.deleteMany({});
  jest.clearAllMocks();
});

const baseEventData = {
  name: 'Photo Test Event',
  address: '1600 Pennsylvania Ave NW, Washington, DC',
  lat: EVENT_LAT,
  lng: EVENT_LNG,
  startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
};

describe('createEvent — local disk photo upload', () => {
  it('should save the event with a local photo URL when a file is provided', async () => {
    const res = await request(app).post('/events').send(baseEventData);

    expect(res.status).toBe(201);
    expect(res.body.event.photo).toMatch(/\/uploads\/event-photos\//);
    expect(res.body.event.name).toBe('Photo Test Event');
  });

  it('should call fs.mkdir and fs.writeFile when saving locally', async () => {
    const fs = require('fs');
    await request(app).post('/events').send(baseEventData);

    expect(fs.promises.mkdir).toHaveBeenCalledWith(
      expect.stringContaining('event-photos'),
      { recursive: true }
    );
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('event-photos'),
      expect.any(Buffer)
    );
  });

  it('should create event without a photo URL when no file is provided', async () => {
    const res = await request(app).post('/events-no-photo').send(baseEventData);

    expect(res.status).toBe(201);
    expect(res.body.event.photo).toBeUndefined();
  });
});
