// setup.js already mocks '../utils/email' globally
jest.mock('../middleware/auth', () => jest.fn((req, res, next) => next()));

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');

const EventFeedback = require('../models/eventFeedback');
const Event = require('../models/event');
const User = require('../models/user');
const errorHandler = require('../middleware/errorHandler');
const eventFeedbackRouter = require('../routes/eventFeedback');
const auth = require('../middleware/auth');

let mongoServer;
let app;
let fakeUserId;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  fakeUserId = new mongoose.Types.ObjectId();

  // Make auth middleware inject req.user for all protected routes
  auth.mockImplementation((req, res, next) => {
    req.user = { _id: fakeUserId };
    next();
  });

  app = express();
  app.use(express.json());
  app.use('/events', eventFeedbackRouter);
  app.use(errorHandler);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await EventFeedback.deleteMany({});
  await Event.deleteMany({});
  await User.deleteMany({});
  jest.clearAllMocks();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function makeEvent() {
  return Event.create({
    title: 'Test Event',
    date: new Date(Date.now() + 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() + 25 * 60 * 60 * 1000),
    location: { name: 'Test Venue', address: '123 Main St' },
    city: 'Washington',
    state: 'DC',
  });
}

function makeFeedbackDoc(overrides = {}) {
  return {
    userId: new mongoose.Types.ObjectId(),
    token: `tok-${Math.random().toString(36).slice(2)}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

// ─── GET /events/feedback/:token ─────────────────────────────────────────────

describe('GET /events/feedback/:token', () => {
  it('should return 404 for an unknown token', async () => {
    const res = await request(app).get('/events/feedback/not-a-real-token');
    expect(res.status).toBe(404);
  });

  it('should return 400 when feedback has already been submitted', async () => {
    const doc = await EventFeedback.create(makeFeedbackDoc({ submitted: true }));
    const res = await request(app).get(`/events/feedback/${doc.token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already submitted/i);
  });

  it('should return 400 when the feedback link has expired', async () => {
    const doc = await EventFeedback.create(
      makeFeedbackDoc({ expiresAt: new Date(Date.now() - 1000) })
    );
    const res = await request(app).get(`/events/feedback/${doc.token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/i);
  });

  it('should return 200 with place details for place-based feedback', async () => {
    const doc = await EventFeedback.create(
      makeFeedbackDoc({
        placeId: 'ChIJplace123',
        placeName: 'Cool Bar',
        placeAddress: '456 Bar St',
      })
    );

    const res = await request(app).get(`/events/feedback/${doc.token}`);
    expect(res.status).toBe(200);
    expect(res.body.placeId).toBe('ChIJplace123');
    expect(res.body.eventName).toBe('Cool Bar');
  });

  it('should return 200 with event details for event-based feedback', async () => {
    const event = await makeEvent();
    const doc = await EventFeedback.create(
      makeFeedbackDoc({ eventId: event._id, userId: fakeUserId })
    );

    const res = await request(app).get(`/events/feedback/${doc.token}`);
    expect(res.status).toBe(200);
    expect(res.body.eventId).toBe(event._id.toString());
    expect(res.body.eventName).toBe('Test Event');
    expect(res.body.city).toBe('Washington');
  });
});

// ─── POST /events/feedback/:token ────────────────────────────────────────────

describe('POST /events/feedback/:token', () => {
  it('should return 400 when rating is missing', async () => {
    const doc = await EventFeedback.create(makeFeedbackDoc());
    const res = await request(app)
      .post(`/events/feedback/${doc.token}`)
      .send({ comment: 'Nice event' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/rating/i);
  });

  it('should return 400 when rating is out of range', async () => {
    const doc = await EventFeedback.create(makeFeedbackDoc());
    const res = await request(app)
      .post(`/events/feedback/${doc.token}`)
      .send({ rating: 0 });
    expect(res.status).toBe(400);
  });

  it('should return 404 for an unknown token', async () => {
    const res = await request(app)
      .post('/events/feedback/nonexistent-token')
      .send({ rating: 4 });
    expect(res.status).toBe(404);
  });

  it('should return 400 when feedback is already submitted', async () => {
    const doc = await EventFeedback.create(makeFeedbackDoc({ submitted: true }));
    const res = await request(app)
      .post(`/events/feedback/${doc.token}`)
      .send({ rating: 3 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already submitted/i);
  });

  it('should return 400 for an expired feedback request', async () => {
    const doc = await EventFeedback.create(
      makeFeedbackDoc({ expiresAt: new Date(Date.now() - 1000) })
    );
    const res = await request(app)
      .post(`/events/feedback/${doc.token}`)
      .send({ rating: 5 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('should return 200 and mark feedback as submitted', async () => {
    const doc = await EventFeedback.create(makeFeedbackDoc());
    const res = await request(app)
      .post(`/events/feedback/${doc.token}`)
      .send({ rating: 4, comment: 'Great event!' });
    expect(res.status).toBe(200);
    expect(res.body.feedback.rating).toBe(4);

    const updated = await EventFeedback.findById(doc._id);
    expect(updated.submitted).toBe(true);
    expect(updated.rating).toBe(4);
    expect(updated.comment).toBe('Great event!');
  });

  it('should save venue suggestion when provided', async () => {
    const doc = await EventFeedback.create(makeFeedbackDoc());
    const res = await request(app)
      .post(`/events/feedback/${doc.token}`)
      .send({
        rating: 5,
        venueSuggestion: { name: 'The Rooftop', address: '789 High St', city: 'DC', state: 'DC', type: 'bar' },
      });
    expect(res.status).toBe(200);
    expect(res.body.feedback.hasVenueSuggestion).toBe(true);

    const updated = await EventFeedback.findById(doc._id);
    expect(updated.venueSuggestion.name).toBe('The Rooftop');
    expect(updated.venueSuggestion.type).toBe('bar');
  });
});

// ─── GET /events/event/:eventId/feedback ─────────────────────────────────────

describe('GET /events/event/:eventId/feedback', () => {
  it('should return totals and average rating of 0 when no feedback exists', async () => {
    const event = await makeEvent();
    const res = await request(app).get(`/events/event/${event._id}/feedback`);
    expect(res.status).toBe(200);
    expect(res.body.totalFeedbacks).toBe(0);
    expect(res.body.averageRating).toBe('0.0');
  });

  it('should return submitted feedbacks with computed average rating', async () => {
    const event = await makeEvent();

    await EventFeedback.create([
      makeFeedbackDoc({ eventId: event._id, submitted: true, rating: 4 }),
      makeFeedbackDoc({ eventId: event._id, submitted: true, rating: 2 }),
      // Unsubmitted — should not be counted
      makeFeedbackDoc({ eventId: event._id, submitted: false }),
    ]);

    const res = await request(app).get(`/events/event/${event._id}/feedback`);
    expect(res.status).toBe(200);
    expect(res.body.totalFeedbacks).toBe(2);
    expect(res.body.averageRating).toBe('3.0');
  });

  it('should count venue suggestions separately', async () => {
    const event = await makeEvent();
    await EventFeedback.create([
      makeFeedbackDoc({
        eventId: event._id,
        submitted: true,
        rating: 5,
        venueSuggestion: { name: 'Park Spot' },
      }),
      makeFeedbackDoc({ eventId: event._id, submitted: true, rating: 3 }),
    ]);

    const res = await request(app).get(`/events/event/${event._id}/feedback`);
    expect(res.status).toBe(200);
    expect(res.body.venueSuggestionsCount).toBe(1);
  });
});

// ─── GET /events/venue-suggestions ───────────────────────────────────────────

describe('GET /events/venue-suggestions', () => {
  it('should return 200 with empty suggestions when none exist', async () => {
    const res = await request(app).get('/events/venue-suggestions');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
    expect(res.body.suggestions).toHaveLength(0);
  });

  it('should return all submitted venue suggestions', async () => {
    const event = await makeEvent();
    await EventFeedback.create([
      makeFeedbackDoc({
        eventId: event._id,
        submitted: true,
        rating: 4,
        venueSuggestion: { name: 'Cozy Cafe', type: 'cafe', city: 'DC', state: 'DC' },
      }),
      // Feedback without a venue suggestion — should not appear
      makeFeedbackDoc({ eventId: event._id, submitted: true, rating: 3 }),
    ]);

    const res = await request(app).get('/events/venue-suggestions');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.suggestions[0].name).toBe('Cozy Cafe');
    expect(res.body.suggestions[0].type).toBe('cafe');
  });
});
