// Tests for middleware/requestLogger.js
const EventEmitter = require('events');
const requestLogger = require('../middleware/requestLogger');

function makeReq(overrides = {}) {
  return {
    method: 'GET',
    originalUrl: '/api/test',
    ip: '127.0.0.1',
    connection: { remoteAddress: '127.0.0.1' },
    get: jest.fn().mockReturnValue('jest-test-agent'),
    ...overrides,
  };
}

function makeRes(statusCode = 200) {
  const res = new EventEmitter();
  res.statusCode = statusCode;
  return res;
}

describe('requestLogger middleware', () => {
  it('should call next() after logging the incoming request', () => {
    const next = jest.fn();
    requestLogger(makeReq(), makeRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should log response details at http level for 2xx responses on finish', () => {
    const next = jest.fn();
    const res = makeRes(200);
    requestLogger(makeReq({ method: 'POST', originalUrl: '/api/signup' }), res, next);
    // Triggering finish should not throw
    expect(() => res.emit('finish')).not.toThrow();
    expect(next).toHaveBeenCalled();
  });

  it('should log response details at warn level for 4xx responses on finish', () => {
    const next = jest.fn();
    const res = makeRes(404);
    requestLogger(makeReq({ method: 'GET', originalUrl: '/api/missing' }), res, next);
    expect(() => res.emit('finish')).not.toThrow();
    expect(next).toHaveBeenCalled();
  });

  it('should use connection.remoteAddress when req.ip is falsy', () => {
    const next = jest.fn();
    const req = makeReq({ ip: null });
    const res = makeRes(200);
    requestLogger(req, res, next);
    res.emit('finish');
    expect(next).toHaveBeenCalled();
  });
});
