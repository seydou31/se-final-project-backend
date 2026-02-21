/* eslint-env jest */
// Manual mock for sharp — avoids platform-specific native binaries in CI.
// Returns a chainable object whose toBuffer() resolves to a small JPEG-like buffer.
const mockBuffer = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, // JPEG SOI + APP0 marker
  ...Buffer.alloc(60, 0x00),
]);

const sharpInstance = {
  resize: jest.fn().mockReturnThis(),
  rotate: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  png: jest.fn().mockReturnThis(),
  webp: jest.fn().mockReturnThis(),
  metadata: jest.fn().mockResolvedValue({ width: 100, height: 100 }),
  toBuffer: jest.fn().mockResolvedValue(mockBuffer),
};

const sharp = jest.fn().mockReturnValue(sharpInstance);
module.exports = sharp;
