import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment
 * Key should be 32 bytes (256 bits) base64 encoded
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  const keyBuffer = Buffer.from(key, 'base64');
  if (keyBuffer.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes (256 bits) when base64 decoded');
  }

  return keyBuffer;
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * Returns: iv:authTag:ciphertext (all base64 encoded)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a ciphertext string encrypted with encrypt()
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format');
  }

  const [ivBase64, authTagBase64, encryptedBase64] = parts;

  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const encrypted = Buffer.from(encryptedBase64, 'base64');

  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length');
  }

  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid auth tag length');
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Generate a random encryption key (for initial setup)
 * Returns base64 encoded 32-byte key
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('base64');
}

/**
 * Safely encrypt a value, returning null if encryption fails or value is empty
 */
export function safeEncrypt(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    return encrypt(value);
  } catch (error) {
    console.error('Encryption failed:', error);
    return null;
  }
}

/**
 * Safely decrypt a value, returning null if decryption fails or value is empty
 */
export function safeDecrypt(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    return decrypt(value);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}
