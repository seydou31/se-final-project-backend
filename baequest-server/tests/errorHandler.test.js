const request = require('supertest');
const express = require('express');

const errorHandler = require('../middleware/errorHandler');
const {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} = require('../utils/customErrors');

// Build a minimal app that throws a specific error on GET /test
function makeApp(buildError) {
  const app = express();
  app.get('/test', (req, res, next) => next(buildError()));
  app.use(errorHandler);
  return app;
}

describe('errorHandler middleware', () => {
  it('should forward custom BadRequestError (400)', async () => {
    const res = await request(makeApp(() => new BadRequestError('bad input'))).get('/test');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('bad input');
    expect(res.body.error).toBe('BadRequestError');
  });

  it('should forward custom UnauthorizedError (401)', async () => {
    const res = await request(makeApp(() => new UnauthorizedError('not auth'))).get('/test');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UnauthorizedError');
  });

  it('should forward custom ForbiddenError (403)', async () => {
    const res = await request(makeApp(() => new ForbiddenError('forbidden'))).get('/test');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ForbiddenError');
  });

  it('should forward custom NotFoundError (404)', async () => {
    const res = await request(makeApp(() => new NotFoundError('not here'))).get('/test');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('not here');
    expect(res.body.error).toBe('NotFoundError');
  });

  it('should forward custom ConflictError (409)', async () => {
    const res = await request(makeApp(() => new ConflictError('conflict'))).get('/test');
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('ConflictError');
  });

  it('should handle Mongoose ValidationError as 400', async () => {
    const err = () => {
      const e = new Error('validation failed');
      e.name = 'ValidationError';
      return e;
    };
    const res = await request(makeApp(err)).get('/test');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
  });

  it('should handle Mongoose CastError as 400 with a fixed message', async () => {
    const err = () => {
      const e = new Error('cast failed');
      e.name = 'CastError';
      return e;
    };
    const res = await request(makeApp(err)).get('/test');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid ID format');
    expect(res.body.error).toBe('CastError');
  });

  it('should handle Mongoose DocumentNotFoundError as 404', async () => {
    const err = () => {
      const e = new Error('doc not found');
      e.name = 'DocumentNotFoundError';
      return e;
    };
    const res = await request(makeApp(err)).get('/test');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('NotFoundError');
  });

  it('should handle duplicate-key error (code 11000) as 409', async () => {
    const err = () => {
      const e = new Error('duplicate');
      e.code = 11000;
      return e;
    };
    const res = await request(makeApp(err)).get('/test');
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('DuplicateKeyError');
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('should handle JsonWebTokenError as 401', async () => {
    const err = () => {
      const e = new Error('invalid token');
      e.name = 'JsonWebTokenError';
      return e;
    };
    const res = await request(makeApp(err)).get('/test');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('JsonWebTokenError');
  });

  it('should handle TokenExpiredError as 401', async () => {
    const err = () => {
      const e = new Error('jwt expired');
      e.name = 'TokenExpiredError';
      return e;
    };
    const res = await request(makeApp(err)).get('/test');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('TokenExpiredError');
  });

  it('should return 500 for unknown errors', async () => {
    const res = await request(makeApp(() => new Error('something broke'))).get('/test');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('InternalServerError');
    expect(res.body.message).toBe('something broke');
  });
});
