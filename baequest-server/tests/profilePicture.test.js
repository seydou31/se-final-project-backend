// Tests for uploadProfilePicture — local disk storage path (isS3Configured = false)
// Each Jest test file runs in its own module registry, so this mock is isolated.

jest.mock('../middleware/multer', () => ({
  isS3Configured: false,
}));

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    // Preserve all real fs methods (existsSync, statSync, etc.) so that
    // winston-daily-rotate-file and other transitive deps continue to work.
    ...actualFs,
    promises: {
      // Preserve all real promise-based methods (stat, readFile, etc.)
      ...actualFs.promises,
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
    },
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
const { NotFoundError } = require('../utils/customErrors');

const fakeUserId = new mongoose.Types.ObjectId();

// Minimal app that injects req.file and other middleware-set fields
function makeApp({ injectFile = true } = {}) {
  const app = express();
  app.use(express.json());

  app.post('/upload', (req, res, next) => {
    req.user = { _id: fakeUserId };
    if (injectFile) {
      req.file = {
        buffer: Buffer.from('fake-image-data'),
        originalname: 'photo.jpg',
        size: 2048,
      };
      req.secureFilename = 'abc123-photo.jpg';
      req.validatedFileType = { mime: 'image/jpeg' };
    }
    next();
  }, profileController.uploadProfilePicture);

  // Inline error handler matching the app's real handler shape
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({ message: err.message, error: err.message });
  });

  return app;
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('uploadProfilePicture — local disk storage', () => {
  it('should return 400 when no file is present on the request', async () => {
    const app = makeApp({ injectFile: false });
    const res = await request(app).post('/upload');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no file/i);
  });

  it('should write the file to disk and return 200 with a local URL', async () => {
    const fakeProfile = {
      _id: new mongoose.Types.ObjectId(),
      profilePicture: '/uploads/profile-pictures/abc123-photo.jpg',
    };
    mockFindOneAndUpdate.mockReturnValue({
      orFail: jest.fn().mockResolvedValue(fakeProfile),
    });

    const app = makeApp();
    const res = await request(app).post('/upload');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Profile picture uploaded successfully');
    expect(res.body.storageType).toBe('local');
    expect(res.body.profilePicture).toMatch(/abc123-photo\.jpg/);
    expect(res.body.mimeType).toBe('image/jpeg');

    // Verify the profile model was updated
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { owner: fakeUserId },
      { profilePicture: '/uploads/profile-pictures/abc123-photo.jpg' },
      expect.objectContaining({ new: true })
    );
  });

  it('should return 404 when the profile does not exist', async () => {
    mockFindOneAndUpdate.mockReturnValue({
      orFail: jest.fn().mockRejectedValue(new NotFoundError('Profile not found')),
    });

    const app = makeApp();
    const res = await request(app).post('/upload');
    expect(res.status).toBe(404);
  });

  it('should call fs.mkdir with recursive option before writing', async () => {
    const fs = require('fs');
    const fakeProfile = { _id: new mongoose.Types.ObjectId(), profilePicture: '' };
    mockFindOneAndUpdate.mockReturnValue({
      orFail: jest.fn().mockResolvedValue(fakeProfile),
    });

    const app = makeApp();
    await request(app).post('/upload');

    expect(fs.promises.mkdir).toHaveBeenCalledWith(
      expect.stringContaining('profile-pictures'),
      { recursive: true }
    );
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('abc123-photo.jpg'),
      expect.any(Buffer)
    );
  });
});
