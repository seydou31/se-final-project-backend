# Testing Coverage Roadmap

**Current Coverage**: 39.44%
**Realistic Target**: 60-70%
**Stretch Goal**: 80%
**100% Coverage**: Not recommended (diminishing returns)

---

## Current Coverage Breakdown

```
All files:       39.18% ❌ (Need: 60%+)
Controllers:     58.63% ⚠️  (Need: 70%+)
Models:          86.36% ✅ (Great!)
Middleware:      16.66% ❌ (Need: 60%+)
Routes:           0.00% ❌ (Need: 50%+)
Utils:           11.20% ❌ (Need: 50%+)
```

---

## Why Not 100% Coverage?

### Industry Standards
- **Google**: 60-80% coverage
- **Facebook**: 70-80% coverage
- **Microsoft**: 60-75% coverage
- **Industry Average**: 60-70%

### Law of Diminishing Returns
- **First 60%**: High-value tests, catches 90% of bugs
- **60-80%**: Medium-value tests, catches 9% of bugs
- **80-100%**: Low-value tests, catches 1% of bugs

### Problems with 100% Coverage
1. **Time Investment**: Last 20% takes as much time as first 80%
2. **Brittle Tests**: Testing trivial code leads to brittle tests
3. **Maintenance Burden**: More tests = more updates when code changes
4. **False Confidence**: 100% coverage ≠ bug-free code
5. **Low ROI**: Testing getters/setters/configs has minimal value

---

## Priority-Based Testing Strategy

### 🔴 Priority 1: CRITICAL (Target: 90%+ coverage)

**What to Test**:
- Authentication logic
- Authorization checks
- Payment processing (when implemented)
- Data validation
- Security-critical code

**Current Files**:
1. **controllers/users.js** (52.72% → Target: 85%+)
   - Uncovered: Lines 51-52, 106-143, 148-203, 211, 214, 230-256
   - **Missing Tests**:
     - Google OAuth error cases
     - Token refresh logic
     - Password validation edge cases
     - Duplicate email handling

2. **middleware/auth.js** (94.11% → Target: 100%)
   - Almost there! Just line 30 uncovered
   - **Missing Test**: Invalid token format handling

3. **middleware/fileValidation.js** (0% → Target: 80%+)
   - **CRITICAL SECURITY CODE - MUST TEST**
   - Test cases needed:
     - Valid image upload
     - Malicious file (executable disguised as image)
     - Oversized file
     - XSS attempt in filename
     - EXIF metadata stripping
     - Image optimization

4. **middleware/validation.js** (0% → Target: 70%+)
   - **IMPORTANT SECURITY CODE**
   - Test cases needed:
     - XSS sanitization function
     - Password strength validation
     - Name pattern validation
     - Interests uniqueness check
     - All Joi schemas

**Estimated Time**: 6-8 hours
**Impact**: Catches 70% of potential bugs

---

### 🟡 Priority 2: HIGH (Target: 70%+ coverage)

**What to Test**:
- Business logic
- Data transformation
- API endpoints
- Database operations

**Current Files**:
1. **controllers/passwordReset.js** (0% → Target: 70%+)
   - Complete password reset flow untested
   - **Missing Tests**:
     - Request password reset
     - Invalid token
     - Expired token
     - Password update success

2. **controllers/profile.js** (58.62% → Target: 75%+)
   - Uncovered: Lines 56, 76-152
   - **Missing Tests**:
     - Profile picture upload (with file validation)
     - Update profile
     - Delete profile
     - S3 vs local storage paths

3. **controllers/emailVerification.js** (69.38% → Target: 85%+)
   - Uncovered: Lines 16, 52-53, 64, 93-110
   - **Missing Tests**:
     - Resend verification
     - Verification email sending failures
     - Token already used

4. **routes/** (0% → Target: 50%+)
   - Routes are simple but should be tested
   - Test middleware chain execution
   - Test route parameter validation

**Estimated Time**: 8-10 hours
**Impact**: Catches 20% of potential bugs

---

### 🟢 Priority 3: MEDIUM (Target: 50%+ coverage)

**What to Test**:
- Utility functions
- Helper methods
- Non-critical paths

**Current Files**:
1. **utils/email.js** (0% → Target: 60%+)
   - Email sending logic
   - **Missing Tests**:
     - Verification email template
     - Password reset email template
     - Email service errors
     - Mock Resend API

2. **utils/customErrors.js** (68.42% → Target: 80%+)
   - Custom error classes
   - Error message formatting

3. **middleware/errorHandler.js** (0% → Target: 40%+)
   - Global error handling
   - Error response formatting

4. **middleware/multer.js** (50% → Target: 60%+)
   - S3 vs local storage logic

**Estimated Time**: 4-6 hours
**Impact**: Catches 8% of potential bugs

---

### ⚪ Priority 4: LOW (Target: 20-30% coverage)

**What to Skip/Minimal Testing**:
- Configuration files
- Simple getters/setters
- Third-party library wrappers
- Logging utilities

**Files to Skip or Minimal Test**:
1. **utils/addStateToEvents.js** (0% → Skip or minimal)
   - Simple data transformation
2. **utils/clearEvents.js** (0% → Skip)
   - Maintenance script
3. **utils/updateTestEvent.js** (0% → Skip)
   - Test helper
4. **middleware/requestLogger.js** (0% → Skip)
   - Simple logging middleware

**Estimated Time**: 1-2 hours
**Impact**: Catches 2% of potential bugs

---

## Roadmap to 60-70% Coverage

### Phase 1: Critical Security (Week 1)
**Goal**: Increase to 50% coverage

**Tasks**:
1. ✅ File validation tests (fileValidation.js)
   - Valid images
   - Malicious files
   - XSS attempts
   - EXIF stripping

2. ✅ Input validation tests (validation.js)
   - XSS sanitization
   - All Joi schemas
   - Edge cases

3. ✅ Complete auth tests (users.js)
   - Google OAuth flows
   - Token refresh
   - Edge cases

**Time**: 6-8 hours
**New Coverage**: ~50%

---

### Phase 2: Core Business Logic (Week 2)
**Goal**: Increase to 60% coverage

**Tasks**:
1. ✅ Password reset flow (passwordReset.js)
2. ✅ Email verification edge cases (emailVerification.js)
3. ✅ Profile operations (profile.js)
4. ✅ Route tests (routes/)

**Time**: 8-10 hours
**New Coverage**: ~60%

---

### Phase 3: Supporting Features (Week 3)
**Goal**: Increase to 70% coverage

**Tasks**:
1. ✅ Email service tests (email.js)
2. ✅ Error handling tests (errorHandler.js)
3. ✅ Utility function tests
4. ✅ Event controller edge cases (event.js)

**Time**: 4-6 hours
**New Coverage**: ~70%

---

## Test Writing Guidelines

### 1. Write Tests for Business Value

**Good Test** (High Value):
```javascript
test('should reject file upload with executable disguised as image', async () => {
  const maliciousFile = createMaliciousExecutable();
  const response = await request(app)
    .post('/users/profile/picture')
    .attach('profilePicture', maliciousFile);

  expect(response.status).toBe(400);
  expect(response.body.error).toContain('Invalid file type');
});
```

**Bad Test** (Low Value):
```javascript
test('should have a name property', () => {
  expect(user.name).toBeDefined(); // Trivial
});
```

### 2. Test Behavior, Not Implementation

**Good**:
```javascript
test('should prevent XSS in name field', async () => {
  const response = await request(app)
    .post('/users/profile')
    .send({ name: '<script>alert("xss")</script>' });

  expect(response.status).toBe(400);
  expect(response.body.error).toContain('unsafe characters');
});
```

**Bad**:
```javascript
test('should call sanitizeString function', () => {
  expect(sanitizeString).toHaveBeenCalled(); // Testing implementation
});
```

### 3. Focus on Edge Cases

**Important Edge Cases**:
- Empty inputs
- Null/undefined values
- Boundary conditions (min/max)
- Invalid data types
- Duplicate entries
- Concurrent requests
- Token expiration
- Network failures

### 4. Use AAA Pattern

```javascript
test('description', async () => {
  // Arrange - Set up test data
  const userData = { email: 'test@example.com', password: 'Test123!' };

  // Act - Perform the action
  const response = await request(app).post('/signup').send(userData);

  // Assert - Verify the result
  expect(response.status).toBe(201);
  expect(response.body.email).toBe(userData.email);
});
```

---

## Specific Test Plan for Key Files

### 1. middleware/fileValidation.js (CRITICAL)

**Test Suite**:
```javascript
describe('File Upload Validation', () => {
  describe('validateFileType', () => {
    test('should accept valid JPEG image');
    test('should accept valid PNG image');
    test('should accept valid WebP image');
    test('should accept valid GIF image');
    test('should reject executable disguised as image');
    test('should reject PDF file');
    test('should reject file >5MB');
    test('should reject file with no extension');
    test('should reject empty file');
  });

  describe('optimizeImage', () => {
    test('should resize image >1200px width');
    test('should strip EXIF metadata');
    test('should compress JPEG with quality 85');
    test('should compress PNG with level 9');
    test('should convert to WebP when enabled');
    test('should not convert GIF to WebP (preserves animation)');
  });

  describe('sanitizeFilename', () => {
    test('should generate secure filename with userId-timestamp-random');
    test('should prevent path traversal (../../etc/passwd)');
    test('should use optimized extension when available');
  });
});
```

**Estimated**: 3-4 hours

---

### 2. middleware/validation.js (CRITICAL)

**Test Suite**:
```javascript
describe('Input Validation', () => {
  describe('sanitizeString', () => {
    test('should remove <script> tags');
    test('should remove all HTML tags');
    test('should trim whitespace');
    test('should reject if sanitized differs from original');
  });

  describe('createUserSchema', () => {
    test('should accept valid email and password');
    test('should reject invalid email format');
    test('should reject password <8 characters');
    test('should reject password without uppercase');
    test('should reject password without lowercase');
    test('should reject password without number');
    test('should reject password without special char');
  });

  describe('createProfileSchema', () => {
    test('should accept valid profile data');
    test('should reject name with numbers');
    test('should reject name with HTML tags');
    test('should reject age <18');
    test('should reject age >120');
    test('should reject negative age');
    test('should reject decimal age');
    test('should reject <3 interests');
    test('should reject >3 interests');
    test('should reject duplicate interests');
    test('should reject interests with XSS');
  });
});
```

**Estimated**: 2-3 hours

---

### 3. controllers/passwordReset.js (HIGH)

**Test Suite**:
```javascript
describe('Password Reset Flow', () => {
  test('should send reset email for valid email');
  test('should return 404 for non-existent email');
  test('should create reset token in database');
  test('should hash reset token before storage');
  test('should reset password with valid token');
  test('should reject expired token');
  test('should reject invalid token');
  test('should reject token already used');
  test('should delete token after successful reset');
  test('should enforce password strength on reset');
});
```

**Estimated**: 2-3 hours

---

## Sample High-Priority Test File

Let me create a test file for file validation:

```javascript
// tests/fileValidation.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const express = require('express');
const { validateFileType, optimizeImage, sanitizeFilename } = require('../middleware/fileValidation');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  app = express();
  app.use(express.json());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('File Upload Validation', () => {
  describe('validateFileType', () => {
    test('should accept valid JPEG image', async () => {
      // Create valid JPEG buffer (starts with FF D8 FF)
      const validJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, ...]);

      const req = {
        file: {
          buffer: validJpeg,
          size: 1024,
          mimetype: 'image/jpeg'
        }
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await validateFileType(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should reject executable disguised as image', async () => {
      // Create executable buffer (starts with MZ - Windows executable)
      const executable = Buffer.from([0x4D, 0x5A, 0x90, 0x00, ...]);

      const req = {
        file: {
          buffer: executable,
          size: 1024,
          mimetype: 'image/jpeg', // Spoofed MIME type
          originalname: 'image.jpg' // Spoofed extension
        }
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await validateFileType(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Invalid file type')
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('should reject file >5MB', async () => {
      const validJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);

      const req = {
        file: {
          buffer: validJpeg,
          size: 6 * 1024 * 1024, // 6MB
          mimetype: 'image/jpeg'
        }
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await validateFileType(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('too large')
        })
      );
    });
  });
});
```

---

## Tools and Techniques

### 1. Generate Coverage Reports
```bash
# Run tests with coverage
npm test -- --coverage

# Generate HTML report
npm test -- --coverage --coverageReporters=html

# Open report
open coverage/lcov-report/index.html
```

### 2. Coverage Threshold in package.json
```json
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 60,
        "functions": 60,
        "lines": 60,
        "statements": 60
      },
      "middleware/fileValidation.js": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

### 3. Focus on Untested Files
```bash
# Test only uncovered files
npm test -- --coverage --collectCoverageFrom='middleware/fileValidation.js'
```

---

## Realistic Timeline

### Option 1: Minimum Viable Testing (60%)
**Timeline**: 2-3 weeks (part-time)
**Effort**: 18-24 hours total
**Result**: Production-ready confidence

### Option 2: Comprehensive Testing (70%)
**Timeline**: 3-4 weeks (part-time)
**Effort**: 28-34 hours total
**Result**: High confidence, industry standard

### Option 3: Extensive Testing (80%)
**Timeline**: 5-6 weeks (part-time)
**Effort**: 40-50 hours total
**Result**: Very high confidence, best practices

### Option 4: Near-Complete Testing (90%+)
**Timeline**: 8-10 weeks (part-time)
**Effort**: 60-80 hours total
**Result**: Diminishing returns, not recommended

---

## Recommendation

🎯 **Target 60-70% coverage focusing on critical paths**

**Rationale**:
- Covers all security-critical code
- Tests core business logic
- Achieves industry standard
- Reasonable time investment
- High bug-catch rate (90%+)

**Priority Order**:
1. **Week 1**: File validation + Input validation (50% total)
2. **Week 2**: Auth flows + Password reset (60% total)
3. **Week 3**: Profile operations + Email service (70% total)

**Total Time**: 18-24 hours over 3 weeks

---

## Conclusion

- ❌ **100% coverage**: Not recommended, massive diminishing returns
- ⚠️ **80-90% coverage**: Possible but expensive, best-in-class
- ✅ **60-70% coverage**: **RECOMMENDED** - industry standard, high value
- ⚠️ **40-50% coverage**: Minimum for production (current: 39.44%)

**Next Steps**:
1. Start with file validation tests (highest security risk)
2. Add input validation tests (XSS prevention)
3. Complete auth flow tests (critical business logic)
4. Iterate based on bug reports and code changes

Focus on **testing what matters**, not hitting an arbitrary number.

---

**Created**: January 25, 2026
**Target Coverage**: 60-70%
**Current Coverage**: 39.44%
**Priority**: Security & Critical Paths
