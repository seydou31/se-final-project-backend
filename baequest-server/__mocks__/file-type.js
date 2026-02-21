// Manual mock for file-type (ESM-only package, not resolvable by Jest's CommonJS resolver)
const fileTypeFromBuffer = jest.fn();
module.exports = { fileTypeFromBuffer };
