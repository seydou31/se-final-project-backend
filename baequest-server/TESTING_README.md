# BaeQuest Backend Testing Guide

## Overview

Comprehensive test suite for the BaeQuest backend API covering authentication, profiles, and events.

## Test Framework

- **Jest**: Test runner and assertion library
- **Supertest**: HTTP assertions for API testing
- **MongoDB Memory Server**: In-memory MongoDB for isolated testing
- **Socket.io**: Real-time communication testing

## Test Files

### 1. Authentication Tests ([tests/auth.test.js](tests/auth.test.js))

**27 tests** covering:
- User signup (email/password)
- User login with JWT tokens
- Logout functionality
- Google OAuth authentication
- User account deletion
- Password hashing and security
- Duplicate email prevention
- Cookie management (HttpOnly, Secure, SameSite)

**Key Test Cases:**
```javascript
// Signup
✓ should create a new user successfully
✓ should reject duplicate email addresses
✓ should hash the password with bcrypt

// Login
✓ should login with correct credentials
✓ should reject incorrect password
✓ should set JWT cookie with correct properties
✓ should create valid JWT token

// Security
✓ should use bcrypt with proper salt rounds
✓ should verify passwords correctly
```

### 2. Profile Tests ([tests/profile.test.js](tests/profile.test.js))

**20 tests** covering:
- Profile creation
- Profile retrieval
- Profile updates
- Profile deletion
- Field validation (age, interests, gender, sexual orientation)
- Authentication requirements

**Key Validations:**
- Age minimum: 18
- Interests: Maximum 3
- Gender: male/female
- Sexual orientation: straight/gay/bisexual
- Required fields: name, age, gender, profession, bio, interests, convoStarter

**Key Test Cases:**
```javascript
// Create Profile
✓ should create a new profile
✓ should validate age minimum (18)
✓ should validate interests array length (max 3)
✓ should require authentication

// Update Profile
✓ should update profile fields
✓ should validate updated fields
✓ should return 404 if profile does not exist

// Delete Profile
✓ should delete user profile
✓ should require authentication
```

### 3. Event Tests ([tests/events.test.js](tests/events.test.js))

**19 tests** covering:
- Event listing (with state filtering)
- Event check-in (location-based)
- Event checkout
- "I'm Going" functionality
- Real-time Socket.io updates
- Location validation
- Expired event filtering

**Location Validation:**
- Maximum distance: 0.005 degrees (~500 meters)
- Checks both latitude and longitude

**Key Test Cases:**
```javascript
// Get Events
✓ should get all active events
✓ should filter events by state
✓ should not include expired events
✓ should show goingCount correctly
✓ should show isUserGoing when user is going

// Check-in
✓ should check in when user is at event location
✓ should reject check-in when user is too far
✓ should return 404 for non-existent event

// I'm Going
✓ should mark user as going to event
✓ should prevent duplicate going marks
✓ should increment count correctly with multiple users
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Authentication tests only
npm run test:auth

# Profile tests only
npm run test:profile

# Event tests only
npm run test:events
```

### Watch Mode (Re-run on file changes)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm test
# Coverage report is generated automatically
```

## Test Coverage Summary

- **66+ tests** total
- **Authentication**: 27 tests
- **Profiles**: 20 tests
- **Events**: 19 tests

### Coverage by Module

- **Controllers**:
  - users.js: Signup, login, logout, Google OAuth, delete user
  - profile.js: Create, get, update, delete profiles
  - event.js: List events, check-in, checkout, mark as going

- **Middleware**:
  - auth.js: JWT authentication

- **Models**:
  - User validation and methods
  - Profile validation and schemas
  - Event schemas and queries

## Test Database

Tests use **MongoDB Memory Server**, which:
- Creates an in-memory MongoDB instance
- Completely isolates tests from production data
- Cleans up after each test automatically
- Runs fast without disk I/O

## Authentication Testing

All authenticated endpoints are tested with:
```javascript
const token = jwt.sign({ _id: userId }, SECRET.JWT_SECRET);

await request(app)
  .get('/users/profile')
  .set('Cookie', [`jwt=${token}`]);
```

## Socket.io Testing

Real-time features tested include:
- Event check-in broadcasts (`user-checked-in`)
- Event checkout broadcasts (`user-checked-out`)
- "I'm Going" count updates (`event-going-updated`)
- Event expiration notifications (`force-checkout`)

## Error Handling

Tests verify proper error responses for:
- 400 Bad Request (missing fields, invalid data)
- 401 Unauthorized (missing/invalid auth)
- 404 Not Found (non-existent resources)
- 409 Conflict (duplicate emails)

## CI/CD Integration

To add to GitHub Actions:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
```

## Best Practices Demonstrated

1. **Isolation**: Each test is independent using `beforeEach` and `afterEach`
2. **Clean State**: Database cleared after every test
3. **Realistic Data**: Uses actual bcrypt hashing and JWT signing
4. **Error Cases**: Tests both success and failure scenarios
5. **Authentication**: Properly tests protected routes
6. **Validation**: Verifies all input validations work
7. **Real-time**: Tests Socket.io event emissions

## Example Test Structure

```javascript
describe('Feature Category', () => {
  let token;
  let userId;

  beforeEach(async () => {
    // Setup test data
    const user = await User.create({ ... });
    userId = user._id;
    token = jwt.sign({ _id: userId }, SECRET.JWT_SECRET);
  });

  afterEach(async () => {
    // Clean up
    await User.deleteMany({});
    await Profile.deleteMany({});
  });

  it('should perform expected action', async () => {
    const res = await request(app)
      .post('/endpoint')
      .set('Cookie', [`jwt=${token}`])
      .send({ data });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('expectedField');
  });
});
```

## Troubleshooting

### Tests Timeout
- Increase timeout in jest.config.js
- Check for unclosed database connections
- Verify MongoDB Memory Server starts properly

### Authentication Fails
- Ensure JWT_SECRET is set in test environment
- Check cookie format matches backend expectations
- Verify auth middleware is properly mocked or included

### Database Errors
- Wait for MongoDB connection before running tests
- Use `beforeAll` and `afterAll` for connection management
- Clear collections in `afterEach`, not `afterAll`

## Future Enhancements

- [ ] Password reset endpoint tests
- [ ] File upload tests (profile pictures)
- [ ] Rate limiting tests
- [ ] Email sending tests (mocked)
- [ ] Google OAuth integration tests (with mocking)
- [ ] End-to-end Socket.io tests with real clients
- [ ] Performance/load testing

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)
- [Testing Best Practices](https://testingjavascript.com/)

---

## Production Ready

Your BaeQuest backend now has:
- ✅ Comprehensive API testing
- ✅ Authentication & authorization tests
- ✅ Database validation tests
- ✅ Real-time Socket.io tests
- ✅ Error handling verification
- ✅ Security testing (password hashing, JWT)

Run `npm test` anytime to verify everything works!
