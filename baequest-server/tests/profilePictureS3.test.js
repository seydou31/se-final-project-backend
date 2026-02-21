// Tests for uploadProfilePicture — S3 storage path (isS3Configured = true)
// Each Jest test file runs in its own module registry, so this mock is isolated.

jest.mock('../middleware/multer', () => ({
  isS3Configured: true,
}));

// Mock the S3 SDK — PublishCommand constructor stores params so we can assert on them
jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn().mockResolvedValue({});
  const MockS3Client = jest.fn().mockImplementation(() => ({ send: mockSend }));
  MockS3Client.__mockSend = mockSend;
  return {
    S3Client: MockS3Client,
    PutObjectCommand: jest.fn().mockImplementation((params) => ({ ...params })),
  };
});

const mockFindOneAndUpdate = jest.fn();
jest.mock('../models/profile', () => ({
  findOneAndUpdate: mockFindOneAndUpdate,
}));

const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const profileController = require('../controllers/profile');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { NotFoundError } = require('../utils/customErrors');

const fakeUserId = new mongoose.Types.ObjectId();

function makeApp({ injectFile = true } = {}) {
  const app = express();
  app.use(express.json());

  app.post('/upload', (req, res, next) => {
    req.user = { _id: fakeUserId };
    if (injectFile) {
      req.file = {
        buffer: Buffer.from('fake-image-data'),
        originalname: 'avatar.png',
        size: 4096,
      };
      req.secureFilename = 'xyz789-avatar.png';
      req.validatedFileType = { mime: 'image/png' };
    }
    next();
  }, profileController.uploadProfilePicture);

  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ message: err.message, error: err.message });
  });

  return app;
}

beforeEach(() => {
  // Set AWS env vars so the S3 branch is exercised
  process.env.AWS_ACCESS_KEY_ID = 'test-key-id';
  process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
  process.env.AWS_S3_BUCKET_NAME = 'test-bucket';
  process.env.AWS_REGION = 'us-east-1';
});

afterEach(() => {
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.AWS_S3_BUCKET_NAME;
  delete process.env.AWS_REGION;
  jest.clearAllMocks();
});

describe('uploadProfilePicture — S3 storage', () => {
  it('should return 400 when no file is present on the request', async () => {
    const app = makeApp({ injectFile: false });
    const res = await request(app).post('/upload');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no file/i);
  });

  it('should upload to S3 and return 200 with an S3 URL', async () => {
    const fakeProfile = {
      _id: new mongoose.Types.ObjectId(),
      profilePicture: 'https://test-bucket.s3.us-east-1.amazonaws.com/profile-pictures/xyz789-avatar.png',
    };
    mockFindOneAndUpdate.mockReturnValue({
      orFail: jest.fn().mockResolvedValue(fakeProfile),
    });

    const app = makeApp();
    const res = await request(app).post('/upload');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Profile picture uploaded successfully');
    expect(res.body.storageType).toBe('s3');
    expect(res.body.profilePicture).toMatch(/amazonaws\.com/);
    expect(res.body.profilePicture).toContain('xyz789-avatar.png');
  });

  it('should create an S3Client and call PutObjectCommand with correct params', async () => {
    const fakeProfile = { _id: new mongoose.Types.ObjectId(), profilePicture: '' };
    mockFindOneAndUpdate.mockReturnValue({
      orFail: jest.fn().mockResolvedValue(fakeProfile),
    });

    const app = makeApp();
    await request(app).post('/upload');

    expect(S3Client).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'us-east-1',
        credentials: expect.objectContaining({
          accessKeyId: 'test-key-id',
          secretAccessKey: 'test-secret-key',
        }),
      })
    );

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'test-bucket',
        Key: 'profile-pictures/xyz789-avatar.png',
        ContentType: 'image/png',
      })
    );

    // Verify send was actually called
    expect(S3Client.__mockSend).toHaveBeenCalled();
  });

  it('should return 404 when the profile does not exist', async () => {
    mockFindOneAndUpdate.mockReturnValue({
      orFail: jest.fn().mockRejectedValue(new NotFoundError('Profile not found')),
    });

    const app = makeApp();
    const res = await request(app).post('/upload');
    expect(res.status).toBe(404);
  });
});
