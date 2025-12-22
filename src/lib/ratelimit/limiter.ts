/**
 * Simple in-memory rate limiter
 * For production, use Redis or a dedicated rate limiting service
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  /** Maximum requests allowed */
  limit: number;
  /** Time window in seconds */
  window: number;
}

// Default rate limits per action
const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  api_request: { limit: 1000, window: 3600 }, // 1000 requests per hour
  upload: { limit: 100, window: 3600 }, // 100 uploads per hour
  query: { limit: 500, window: 3600 }, // 500 queries per hour
};

// In-memory store (cleared on restart)
const store = new Map<string, RateLimitEntry>();

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Start cleanup timer
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  // Don't prevent process from exiting
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

startCleanup();

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (e.g., API key ID or org ID)
 * @param action - The action being performed
 * @returns Rate limit check result
 */
export function checkRateLimit(
  identifier: string,
  action: string = 'api_request'
): {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
} {
  const config = DEFAULT_LIMITS[action] || DEFAULT_LIMITS.api_request;
  const key = `${identifier}:${action}`;
  const now = Date.now();

  let entry = store.get(key);

  // Create or reset entry if expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.window * 1000,
    };
    store.set(key, entry);
  }

  // Check if limit exceeded
  if (entry.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(entry.resetAt),
      limit: config.limit,
    };
  }

  // Increment counter
  entry.count++;

  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetAt: new Date(entry.resetAt),
    limit: config.limit,
  };
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(
  identifier: string,
  action: string = 'api_request'
): Record<string, string> {
  const result = checkRateLimit(identifier, action);
  // Undo the increment since this is just for headers
  const key = `${identifier}:${action}`;
  const entry = store.get(key);
  if (entry) entry.count--;

  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(result.resetAt.getTime() / 1000).toString(),
  };
}

/**
 * Reset rate limit for an identifier (useful for testing)
 */
export function resetRateLimit(identifier: string, action?: string): void {
  if (action) {
    store.delete(`${identifier}:${action}`);
  } else {
    // Delete all entries for this identifier
    for (const key of store.keys()) {
      if (key.startsWith(`${identifier}:`)) {
        store.delete(key);
      }
    }
  }
}

/**
 * Configure custom rate limits for an action
 */
export function setRateLimit(action: string, config: RateLimitConfig): void {
  DEFAULT_LIMITS[action] = config;
}

/**
 * Get current rate limit config for an action
 */
export function getRateLimitConfig(action: string): RateLimitConfig {
  return DEFAULT_LIMITS[action] || DEFAULT_LIMITS.api_request;
}
