import { Request, Response, NextFunction } from 'express';

/**
 * Tests for TASK-004: CSRF protection middleware.
 *
 * The middleware wraps csrf-sync's synchronizer token pattern and adds
 * custom skip logic for device-auth (API-key-only) and pre-authentication
 * public endpoints.
 */

// We import the module under test. This will FAIL until csrfMiddleware.ts exists.
import {
  skipCsrfProtection,
  csrfProtection,
  csrfTokenHandler,
} from '../csrfMiddleware';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockRequest(overrides: Record<string, any> = {}): Request {
  return {
    method: 'POST',
    path: '/api/tenants',
    headers: {},
    session: {},
    ...overrides,
  } as unknown as Request;
}

function createMockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

// ---------------------------------------------------------------------------
// Scenario Group A: skipCsrfProtection callback (unit tests)
// ---------------------------------------------------------------------------

describe('skipCsrfProtection', () => {
  /**
   * Scenario 4: Device-auth endpoints are exempt from CSRF.
   * These use API key authentication, not session cookies.
   */
  describe('device-auth exempt paths', () => {
    it('should skip CSRF for POST /api/device-auth/challenge', () => {
      const req = createMockRequest({ path: '/api/device-auth/challenge', method: 'POST' });
      expect(skipCsrfProtection(req)).toBe(true);
    });

    it('should skip CSRF for POST /api/device-auth/verify', () => {
      const req = createMockRequest({ path: '/api/device-auth/verify', method: 'POST' });
      expect(skipCsrfProtection(req)).toBe(true);
    });
  });

  /**
   * Scenario 4 (continued): Device registration and ping are exempt.
   */
  describe('device registration/ping exempt paths', () => {
    it('should skip CSRF for POST /api/device/register', () => {
      const req = createMockRequest({ path: '/api/device/register', method: 'POST' });
      expect(skipCsrfProtection(req)).toBe(true);
    });

    it('should skip CSRF for POST /api/device/ping', () => {
      const req = createMockRequest({ path: '/api/device/ping', method: 'POST' });
      expect(skipCsrfProtection(req)).toBe(true);
    });
  });

  /**
   * Scenario 4b: Session-authenticated device endpoints are NOT exempt.
   * These use cookies (session auth), so CSRF protection is required.
   */
  describe('session-authenticated device endpoints NOT exempt', () => {
    it('should NOT skip CSRF for POST /api/device/tenant/123/claim', () => {
      const req = createMockRequest({ path: '/api/device/tenant/123/claim', method: 'POST' });
      expect(skipCsrfProtection(req)).toBe(false);
    });

    it('should NOT skip CSRF for DELETE /api/device/tenant/456/devices/789', () => {
      const req = createMockRequest({ path: '/api/device/tenant/456/devices/789', method: 'DELETE' });
      expect(skipCsrfProtection(req)).toBe(false);
    });

    it('should NOT skip CSRF for POST /api/device/tenant/123/devices/456/campaign', () => {
      const req = createMockRequest({ path: '/api/device/tenant/123/devices/456/campaign', method: 'POST' });
      expect(skipCsrfProtection(req)).toBe(false);
    });
  });

  /**
   * Scenario 6: Pre-authentication public endpoints are exempt.
   * These are called before the user has a session.
   */
  describe('pre-auth public endpoint exemptions', () => {
    it('should skip CSRF for POST /api/auth/self-register', () => {
      const req = createMockRequest({ path: '/api/auth/self-register', method: 'POST' });
      expect(skipCsrfProtection(req)).toBe(true);
    });

    it('should skip CSRF for POST /api/auth/webauthn/authentication-options', () => {
      const req = createMockRequest({ path: '/api/auth/webauthn/authentication-options', method: 'POST' });
      expect(skipCsrfProtection(req)).toBe(true);
    });

    it('should skip CSRF for POST /api/auth/webauthn/authenticate', () => {
      const req = createMockRequest({ path: '/api/auth/webauthn/authenticate', method: 'POST' });
      expect(skipCsrfProtection(req)).toBe(true);
    });

    it('should skip CSRF for GET /api/auth/verify-email/some-token-here (path param)', () => {
      const req = createMockRequest({ path: '/api/auth/verify-email/some-token-here', method: 'GET' });
      expect(skipCsrfProtection(req)).toBe(true);
    });
  });

  /**
   * Non-exempt session-authenticated endpoints must NOT be skipped.
   */
  describe('protected session endpoints are NOT exempt', () => {
    it('should NOT skip CSRF for POST /api/tenants', () => {
      const req = createMockRequest({ path: '/api/tenants', method: 'POST' });
      expect(skipCsrfProtection(req)).toBe(false);
    });

    it('should NOT skip CSRF for PUT /api/tenants/123', () => {
      const req = createMockRequest({ path: '/api/tenants/123', method: 'PUT' });
      expect(skipCsrfProtection(req)).toBe(false);
    });

    it('should NOT skip CSRF for DELETE /api/tenants/123', () => {
      const req = createMockRequest({ path: '/api/tenants/123', method: 'DELETE' });
      expect(skipCsrfProtection(req)).toBe(false);
    });

    it('should NOT skip CSRF for POST /api/auth/register', () => {
      const req = createMockRequest({ path: '/api/auth/register', method: 'POST' });
      expect(skipCsrfProtection(req)).toBe(false);
    });

    it('should NOT skip CSRF for POST /api/auth/logout', () => {
      const req = createMockRequest({ path: '/api/auth/logout', method: 'POST' });
      expect(skipCsrfProtection(req)).toBe(false);
    });

    it('should NOT skip CSRF for PUT /api/users/update', () => {
      const req = createMockRequest({ path: '/api/users/update', method: 'PUT' });
      expect(skipCsrfProtection(req)).toBe(false);
    });

    it('should NOT skip CSRF for DELETE /api/users/passkeys/abc', () => {
      const req = createMockRequest({ path: '/api/users/passkeys/abc', method: 'DELETE' });
      expect(skipCsrfProtection(req)).toBe(false);
    });

    it('should NOT skip CSRF for POST /api/auth/complete-registration (has session from email verification)', () => {
      const req = createMockRequest({ path: '/api/auth/complete-registration', method: 'POST' });
      expect(skipCsrfProtection(req)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Scenario Group B: Integration tests for the middleware + token handler
// ---------------------------------------------------------------------------

describe('csrfProtection middleware', () => {
  /**
   * Scenario 5: Safe methods (GET, HEAD, OPTIONS) bypass CSRF.
   */
  describe('safe methods bypass CSRF', () => {
    it.each(['GET', 'HEAD', 'OPTIONS'])('should call next() for %s requests', (method) => {
      const req = createMockRequest({ method, path: '/api/tenants', session: {} });
      const res = createMockResponse();
      const next: NextFunction = jest.fn();

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  /**
   * Scenario 4/6: Exempt paths bypass CSRF even on POST.
   */
  it('should call next() for exempt device-auth paths', () => {
    const req = createMockRequest({ path: '/api/device-auth/challenge', method: 'POST', session: {} });
    const res = createMockResponse();
    const next: NextFunction = jest.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  /**
   * Scenario 2: Missing CSRF token on a protected POST returns 403.
   */
  it('should return 403 when CSRF token is missing on protected POST', () => {
    const req = createMockRequest({
      path: '/api/tenants',
      method: 'POST',
      headers: {},
      session: { csrfToken: 'valid-token-from-session' },
    });
    const res = createMockResponse();
    const next: NextFunction = jest.fn();

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  /**
   * Scenario 3: Invalid/forged CSRF token returns 403.
   */
  it('should return 403 when CSRF token is invalid/forged', () => {
    const req = createMockRequest({
      path: '/api/tenants',
      method: 'POST',
      headers: { 'x-csrf-token': 'forged-token-value' } as Record<string, string>,
      session: { csrfToken: 'real-session-token-value' },
    });
    const res = createMockResponse();
    const next: NextFunction = jest.fn();

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  /**
   * Scenario 1: Valid CSRF token passes through.
   */
  it('should call next() when CSRF token is valid', () => {
    const sessionToken = 'a-valid-csrf-token-stored-in-session';
    const req = createMockRequest({
      path: '/api/tenants',
      method: 'POST',
      headers: { 'x-csrf-token': sessionToken } as Record<string, string>,
      session: { csrfToken: sessionToken },
    });
    const res = createMockResponse();
    const next: NextFunction = jest.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Scenario 7: Token generation endpoint handler
// ---------------------------------------------------------------------------

describe('csrfTokenHandler', () => {
  it('should return a CSRF token as JSON', () => {
    const req = createMockRequest({ session: {} });
    const res = createMockResponse();

    csrfTokenHandler(req, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    const responseArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseArg).toHaveProperty('csrfToken');
    expect(typeof responseArg.csrfToken).toBe('string');
    expect(responseArg.csrfToken.length).toBeGreaterThan(0);
  });

  it('should store the generated token in the session', () => {
    const session: Record<string, unknown> = {};
    const req = createMockRequest({ session });
    const res = createMockResponse();

    csrfTokenHandler(req, res);

    expect(session.csrfToken).toBeDefined();
    expect(typeof session.csrfToken).toBe('string');
  });

  it('should return the same token if one already exists in session', () => {
    const existingToken = 'existing-token-in-session';
    const session: Record<string, unknown> = { csrfToken: existingToken };
    const req = createMockRequest({ session });
    const res = createMockResponse();

    csrfTokenHandler(req, res);

    const responseArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(responseArg.csrfToken).toBe(existingToken);
  });
});
