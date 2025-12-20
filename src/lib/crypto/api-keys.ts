import { createHash, randomBytes } from 'crypto';

const API_KEY_PREFIX = 'mrag_sk_';
const KEY_BYTES = 32; // 256 bits of randomness

export interface GeneratedApiKey {
  /**
   * The full API key (shown once to user)
   * Format: mrag_sk_<base64url random bytes>
   */
  key: string;

  /**
   * SHA-256 hash of the key (stored in database)
   */
  hash: string;

  /**
   * First 12 chars of key for display/identification
   * Format: mrag_sk_xxxx
   */
  prefix: string;
}

/**
 * Generate a new API key
 * Returns the full key (to show user once), hash (to store), and prefix (for display)
 */
export function generateApiKey(): GeneratedApiKey {
  // Generate random bytes and encode as base64url
  const randomPart = randomBytes(KEY_BYTES).toString('base64url');

  // Full key with prefix
  const key = `${API_KEY_PREFIX}${randomPart}`;

  // Hash for storage
  const hash = hashApiKey(key);

  // Display prefix (first 12 chars)
  const prefix = key.substring(0, 12);

  return { key, hash, prefix };
}

/**
 * Hash an API key for storage/lookup
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  if (!key.startsWith(API_KEY_PREFIX)) {
    return false;
  }

  const randomPart = key.substring(API_KEY_PREFIX.length);

  // Check base64url format and minimum length
  if (randomPart.length < 32) {
    return false;
  }

  // Base64url chars: A-Z, a-z, 0-9, -, _
  return /^[A-Za-z0-9_-]+$/.test(randomPart);
}

/**
 * Extract the prefix from an API key for display
 */
export function getKeyPrefix(key: string): string {
  return key.substring(0, 12);
}

/**
 * Mask an API key for display (show first 12 and last 4 chars)
 */
export function maskApiKey(key: string): string {
  if (key.length <= 20) {
    return key.substring(0, 12) + '...';
  }
  return key.substring(0, 12) + '...' + key.substring(key.length - 4);
}

/**
 * Generate a session token for admin auth
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hash a session token for storage
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Hash a password using SHA-256 with salt
 * Note: For production, use bcrypt or argon2 instead
 */
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(password + actualSalt).digest('hex');
  return { hash: `${actualSalt}:${hash}`, salt: actualSalt };
}

/**
 * Verify a password against a stored hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHash] = storedHash.split(':');
  if (!salt || !expectedHash) return false;

  const { hash } = hashPassword(password, salt);
  return hash === storedHash;
}
