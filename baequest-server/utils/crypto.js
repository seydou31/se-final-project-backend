const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const hex = process.env.PHONE_ENCRYPTION_KEY;
  if (!hex) return null;
  return Buffer.from(hex, 'hex');
}

// Encrypts a phone number. Returns "iv:tag:ciphertext" (all hex).
// Falls back to plaintext if PHONE_ENCRYPTION_KEY is not set (dev mode).
const encryptPhone = (plaintext) => {
  const key = getKey();
  if (!key) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};

// Decrypts a phone number stored as "iv:tag:ciphertext".
// Returns the value unchanged if it doesn't match the encrypted format or key is absent.
const decryptPhone = (stored) => {
  const key = getKey();
  if (!key) return stored;
  const parts = stored.split(':');
  if (parts.length !== 3) return stored; // not encrypted format
  const [ivHex, tagHex, encHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};

module.exports = { encryptPhone, decryptPhone };
