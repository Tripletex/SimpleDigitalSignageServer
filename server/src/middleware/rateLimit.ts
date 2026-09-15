/**
 * In-Memory Sliding Window Rate Limiter
 *
 * A simple Map-based rate limiter that tracks request timestamps per client
 * and enforces a maximum number of requests within a sliding time window.
 */

import type { Context, Next } from 'hono';
import type { AppEnv } from '../types/context.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  /** Time window in milliseconds. */
  windowMs: number;
  /** Maximum number of requests allowed within the window. */
  max: number;
  /** Custom message returned when the limit is exceeded. */
  message?: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a rate-limiting middleware with the given configuration.
 *
 * @param config - Rate limit settings.
 * @returns Hono middleware function.
 */
export function rateLimit(config: RateLimitConfig) {
  const hits = new Map<string, number[]>();

  // Periodically clean up expired entries to prevent unbounded memory growth.
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits) {
      const valid = timestamps.filter((t) => now - t < config.windowMs);
      if (valid.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, valid);
      }
    }
  }, config.windowMs);

  return async (c: Context<AppEnv>, next: Next): Promise<void | Response> => {
    // Identify the client by the X-Forwarded-For header (first entry) or
    // fall back to a generic key when running behind a proxy that does not
    // set the header.
    const forwarded = c.req.header('x-forwarded-for');
    const key = forwarded ? forwarded.split(',')[0].trim() : 'unknown';

    const now = Date.now();

    // Filter out timestamps outside the current window
    const timestamps = (hits.get(key) || []).filter(
      (t) => now - t < config.windowMs,
    );

    if (timestamps.length >= config.max) {
      c.res.headers.set('Retry-After', String(Math.ceil(config.windowMs / 1000)));
      return c.json(
        { message: config.message || 'Too many requests' },
        429,
      );
    }

    timestamps.push(now);
    hits.set(key, timestamps);

    await next();
  };
}
