import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * CSRF synchronizer token pattern middleware (TASK-004).
 *
 * Uses a per-session random token stored in req.session.csrfToken.
 * State-changing requests must send the token in the x-csrf-token header.
 * The comparison uses crypto.timingSafeEqual to prevent timing side-channel attacks.
 */

// Paths that are fully exempt from CSRF protection.
// These use API key authentication (not session cookies) or are pre-auth public endpoints.
const EXEMPT_PATH_PREFIXES = [
  '/api/device-auth/',  // All device-auth endpoints (API key auth)
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

/**
 * Determines whether a request should skip CSRF protection.
 * Returns true for API-key-authenticated device endpoints and pre-auth public endpoints.
 */
export function skipCsrfProtection(req: Request): boolean {
  const { path } = req;

  // Check exact paths
  if (EXEMPT_EXACT_PATHS.includes(path)) {
    return true;
  }

  // Check prefix matches
  for (const prefix of EXEMPT_PATH_PREFIXES) {
    if (path.startsWith(prefix)) {
      return true;
    }
  }

  // Check regex patterns
  for (const pattern of EXEMPT_PATH_PATTERNS) {
    if (pattern.test(path)) {
      return true;
    }
  }

  return false;
}

/**
 * Express middleware that enforces the CSRF synchronizer token pattern.
 *
 * - Safe methods (GET, HEAD, OPTIONS) are always allowed.
 * - Exempt paths (device-auth, device registration, pre-auth) bypass CSRF.
 * - All other requests must include an x-csrf-token header matching req.session.csrfToken.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Safe methods never need CSRF validation
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  // Exempt paths bypass CSRF
  if (skipCsrfProtection(req)) {
    next();
    return;
  }

  const sessionToken = req.session?.csrfToken;
  const headerToken = req.headers['x-csrf-token'] as string | undefined;

  // Both tokens must be present
  if (!sessionToken || !headerToken) {
    res.status(403).json({ success: false, message: 'CSRF token missing' });
    return;
  }

  // Constant-time comparison to prevent timing attacks.
  // timingSafeEqual throws if buffers have different lengths, so check first.
  const sessionBuf = Buffer.from(sessionToken, 'utf8');
  const headerBuf = Buffer.from(headerToken, 'utf8');

  if (sessionBuf.length !== headerBuf.length || !crypto.timingSafeEqual(sessionBuf, headerBuf)) {
    res.status(403).json({ success: false, message: 'CSRF token invalid' });
    return;
  }

  next();
}

/**
 * Handler for GET /api/auth/csrf-token.
 * Returns the current CSRF token or generates a new one if none exists.
 */
export function csrfTokenHandler(req: Request, res: Response): void {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }

  res.json({ csrfToken: req.session.csrfToken });
}
