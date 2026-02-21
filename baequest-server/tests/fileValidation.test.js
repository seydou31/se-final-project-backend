// file-type and sharp are both mocked via moduleNameMapper → __mocks__/*.js
// This keeps the tests cross-platform (no native binaries required in CI).

const mongoose = require('mongoose');
const { fileTypeFromBuffer } = require('file-type');
const { validateFileType, optimizeImage, sanitizeFilename } = require('../middleware/fileValidation');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ─── validateFileType ─────────────────────────────────────────────────────────

describe('validateFileType', () => {
  afterEach(() => jest.clearAllMocks());

  it('should return 400 when no file is present on the request', async () => {
    const req = { file: null };
    const res = makeRes();
    const next = jest.fn();

    await validateFileType(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 400 when file type cannot be determined', async () => {
    fileTypeFromBuffer.mockResolvedValue(null);
    const req = { file: { buffer: Buffer.alloc(64), size: 64 } };
    const res = makeRes();
    const next = jest.fn();

    await validateFileType(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 400 when the detected MIME type is not an allowed image type', async () => {
    fileTypeFromBuffer.mockResolvedValue({ mime: 'application/pdf', ext: 'pdf' });
    const req = { file: { buffer: Buffer.alloc(64), size: 64 } };
    const res = makeRes();
    const next = jest.fn();

    await validateFileType(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringMatching(/invalid file type/i) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 400 when the file size exceeds 5 MB', async () => {
    fileTypeFromBuffer.mockResolvedValue({ mime: 'image/jpeg', ext: 'jpg' });
    // Override req.file.size to simulate an oversized upload
    const req = { file: { buffer: Buffer.alloc(64), size: 5 * 1024 * 1024 + 1 } };
    const res = makeRes();
    const next = jest.fn();

    await validateFileType(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringMatching(/too large/i) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next and set req.validatedFileType for a valid JPEG', async () => {
    fileTypeFromBuffer.mockResolvedValue({ mime: 'image/jpeg', ext: 'jpg' });
    const req = { file: { buffer: Buffer.alloc(64), size: 64 } };
    const res = makeRes();
    const next = jest.fn();

    await validateFileType(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.validatedFileType.mime).toBe('image/jpeg');
  });

  it('should call next and set req.validatedFileType for a valid PNG', async () => {
    fileTypeFromBuffer.mockResolvedValue({ mime: 'image/png', ext: 'png' });
    const req = { file: { buffer: Buffer.alloc(64), size: 64 } };
    const res = makeRes();
    const next = jest.fn();

    await validateFileType(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.validatedFileType.mime).toBe('image/png');
  });

  it('should call next for a valid WebP file', async () => {
    fileTypeFromBuffer.mockResolvedValue({ mime: 'image/webp', ext: 'webp' });
    const req = { file: { buffer: Buffer.alloc(64), size: 64 } };
    const res = makeRes();
    const next = jest.fn();

    await validateFileType(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.validatedFileType.mime).toBe('image/webp');
  });
});

// ─── optimizeImage ────────────────────────────────────────────────────────────

describe('optimizeImage', () => {
  afterEach(() => jest.clearAllMocks());

  it('should call next immediately when no file is present', async () => {
    const req = { file: null };
    const res = makeRes();
    const next = jest.fn();

    await optimizeImage(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should process a JPEG buffer, update req.file.buffer, and call next', async () => {
    const req = {
      file: { buffer: Buffer.alloc(64), size: 64, originalname: 'photo.jpg' },
      validatedFileType: { mime: 'image/jpeg' },
    };
    const res = makeRes();
    const next = jest.fn();

    await optimizeImage(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.file.buffer).toBeInstanceOf(Buffer);
    expect(req.file.size).toBe(req.file.buffer.length);
  });

  it('should process a PNG buffer, update req.file.buffer, and call next', async () => {
    const req = {
      file: { buffer: Buffer.alloc(64), size: 64, originalname: 'image.png' },
      validatedFileType: { mime: 'image/png' },
    };
    const res = makeRes();
    const next = jest.fn();

    await optimizeImage(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.file.buffer).toBeInstanceOf(Buffer);
  });
});

// ─── sanitizeFilename ─────────────────────────────────────────────────────────

describe('sanitizeFilename', () => {
  it('should call next without modification when no file is present', () => {
    const req = { file: null };
    const res = makeRes();
    const next = jest.fn();

    sanitizeFilename(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should generate a secure filename in the format <userId>-<timestamp>-<random><ext>', () => {
    const userId = new mongoose.Types.ObjectId();
    const req = {
      file: { originalname: 'my photo.jpg' },
      user: { _id: userId },
      optimizedExtension: '.jpg',
    };
    const res = makeRes();
    const next = jest.fn();

    sanitizeFilename(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.file.filename).toMatch(
      new RegExp(`^${userId.toString()}-\\d+-[a-z0-9]+\\.jpg$`)
    );
    expect(req.secureFilename).toBe(req.file.filename);
  });

  it('should strip path-traversal sequences from the extension', () => {
    const userId = new mongoose.Types.ObjectId();
    const req = {
      file: { originalname: '../../../etc/passwd.jpg' },
      user: { _id: userId },
    };
    const res = makeRes();
    const next = jest.fn();

    sanitizeFilename(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.file.filename).not.toContain('..');
    expect(req.file.filename).not.toContain('/');
  });

  it('should use originalname extension when optimizedExtension is absent', () => {
    const userId = new mongoose.Types.ObjectId();
    const req = {
      file: { originalname: 'avatar.png' },
      user: { _id: userId },
    };
    const res = makeRes();
    const next = jest.fn();

    sanitizeFilename(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.file.filename).toMatch(/\.png$/);
  });
});
