/**
 * CSRF Synchronizer Token Pattern Middleware
 *
 * Uses a per-session random token stored in session.csrfToken.
 * State-changing requests must send the token in the x-csrf-token header.
 * Comparison uses constant-time equality to prevent timing side-channel attacks.
 */

import type { Context, Next } from 'hono';
import { timingSafeEqual } from '@std/crypto/timing-safe-equal';
import type { AppEnv } from '../types/context.ts';

// ---------------------------------------------------------------------------
// Exempt path configuration
// ---------------------------------------------------------------------------

/** Paths that are fully exempt from CSRF protection. */
const EXEMPT_PATH_PREFIXES = [
  '/api/device-auth/', // All device-auth endpoints (API key auth)
];

const EXEMPT_EXACT_PATHS = [
  '/api/device/register', // Device self-registration (API key auth)
  '/api/device/ping',     // Device heartbeat (API key auth)
  '/api/auth/self-register',
  '/api/auth/webauthn/authentication-options',
  '/api/auth/webauthn/authenticate',
];

const EXEMPT_PATH_PATTERNS = [
  /^\/api\/auth\/verify-email\/.+$/, // /api/auth/verify-email/:token
];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encoder = new TextEncoder();

/**
 * Generate a cryptographically secure random hex token.
 */
function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time string comparison.
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);

  if (bufA.byteLength !== bufB.byteLength) {
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}

/**
 * Determines whether a request should skip CSRF protection.
 */
export function skipCsrfProtection(path: string): boolean {
  if (EXEMPT_EXACT_PATHS.includes(path)) {
    return true;
  }

  for (const prefix of EXEMPT_PATH_PREFIXES) {
    if (path.startsWith(prefix)) {
      return true;
    }
  }

  for (const pattern of EXEMPT_PATH_PATTERNS) {
    if (pattern.test(path)) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * CSRF protection middleware.
 *
 * - Safe methods (GET, HEAD, OPTIONS) are always allowed.
 * - Exempt paths (device-auth, device registration, pre-auth) bypass CSRF.
 * - All other requests must include an x-csrf-token header matching the session token.
 */
export async function csrfProtection(
  c: Context<AppEnv>,
  next: Next,
): Promise<void | Response> {
  // Safe methods never need CSRF validation
  if (SAFE_METHODS.has(c.req.method)) {
    await next();
    return;
  }

  // Exempt paths bypass CSRF
  if (skipCsrfProtection(c.req.path)) {
    await next();
    return;
  }

  const session = c.get('session');
  const sessionToken = session?.csrfToken as string | undefined;
  const headerToken = c.req.header('x-csrf-token');

  // Both tokens must be present
  if (!sessionToken || !headerToken) {
    return c.json({ success: false, message: 'CSRF token missing' }, 403);
  }

  // Constant-time comparison
  if (!safeCompare(sessionToken, headerToken)) {
    return c.json({ success: false, message: 'CSRF token invalid' }, 403);
  }

  await next();
}

/**
 * Handler for GET /api/auth/csrf-token.
 * Returns the current CSRF token or generates a new one if none exists.
 */
export async function csrfTokenHandler(
  c: Context<AppEnv>,
): Promise<Response> {
  const session = c.get('session');

  if (!session.csrfToken) {
    session.csrfToken = generateToken();
    await session.save();
  }

  return c.json({ csrfToken: session.csrfToken });
}
