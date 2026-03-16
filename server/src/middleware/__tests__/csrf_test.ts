/**
 * Tests for CSRF protection middleware.
 *
 * Ported from server/src/middleware/__tests__/csrfMiddleware.test.ts
 * Tests the skip logic and token validation.
 */

import { assertEquals, assertNotEquals } from '@std/assert';
import { Hono } from 'hono';
import type { AppEnv } from '../../types/context.ts';
import { skipCsrfProtection, csrfProtection, csrfTokenHandler } from '../csrf.ts';

// ---------------------------------------------------------------------------
// Unit tests: skipCsrfProtection
// ---------------------------------------------------------------------------

Deno.test('skipCsrfProtection - device-auth endpoints are exempt', () => {
  assertEquals(skipCsrfProtection('/api/device-auth/challenge'), true);
  assertEquals(skipCsrfProtection('/api/device-auth/verify'), true);
});

Deno.test('skipCsrfProtection - device registration/ping are exempt', () => {
  assertEquals(skipCsrfProtection('/api/device/register'), true);
  assertEquals(skipCsrfProtection('/api/device/ping'), true);
});

Deno.test('skipCsrfProtection - session-authenticated device endpoints are NOT exempt', () => {
  assertEquals(skipCsrfProtection('/api/device/tenant/123/claim'), false);
  assertEquals(skipCsrfProtection('/api/device/tenant/456/devices/789'), false);
  assertEquals(skipCsrfProtection('/api/device/tenant/123/devices/456/campaign'), false);
});

Deno.test('skipCsrfProtection - pre-auth public endpoints are exempt', () => {
  assertEquals(skipCsrfProtection('/api/auth/self-register'), true);
  assertEquals(skipCsrfProtection('/api/auth/webauthn/authentication-options'), true);
  assertEquals(skipCsrfProtection('/api/auth/webauthn/authenticate'), true);
  assertEquals(skipCsrfProtection('/api/auth/verify-email/some-token-here'), true);
});

Deno.test('skipCsrfProtection - protected session endpoints are NOT exempt', () => {
  assertEquals(skipCsrfProtection('/api/tenants'), false);
  assertEquals(skipCsrfProtection('/api/tenants/123'), false);
  assertEquals(skipCsrfProtection('/api/auth/register'), false);
  assertEquals(skipCsrfProtection('/api/auth/logout'), false);
  assertEquals(skipCsrfProtection('/api/users/update'), false);
  assertEquals(skipCsrfProtection('/api/users/passkeys/abc'), false);
  assertEquals(skipCsrfProtection('/api/auth/complete-registration'), false);
});

// ---------------------------------------------------------------------------
// Integration tests: csrfProtection middleware via Hono
// ---------------------------------------------------------------------------

/** Create a minimal Hono app with CSRF middleware and a mock session. */
function createTestApp(sessionData: Record<string, unknown> = {}) {
  const app = new Hono<AppEnv>();

  // Mock session middleware
  app.use('*', async (c, next) => {
    const session = {
      ...sessionData,
      save: async () => {},
      regenerate: async () => {},
      destroy: async () => {},
    };
    c.set('session', session as any);
    await next();
  });

  // CSRF protection
  app.use('*', csrfProtection);

  // Test endpoints
  app.get('/api/tenants', (c) => c.json({ ok: true }));
  app.post('/api/tenants', (c) => c.json({ ok: true }));
  app.post('/api/device-auth/challenge', (c) => c.json({ ok: true }));
  app.post('/api/auth/self-register', (c) => c.json({ ok: true }));

  return app;
}

Deno.test('csrfProtection - safe methods (GET, HEAD, OPTIONS) bypass CSRF', async () => {
  const app = createTestApp();

  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    const res = await app.request('/api/tenants', { method });
    assertNotEquals(res.status, 403, `${method} should not be blocked`);
  }
});

Deno.test('csrfProtection - exempt paths bypass CSRF even on POST', async () => {
  const app = createTestApp();

  const res = await app.request('/api/device-auth/challenge', { method: 'POST' });
  assertNotEquals(res.status, 403);
});

Deno.test('csrfProtection - missing CSRF token on protected POST returns 403', async () => {
  const app = createTestApp({ csrfToken: 'valid-token-from-session' });

  const res = await app.request('/api/tenants', {
    method: 'POST',
    headers: {},
  });
  assertEquals(res.status, 403);
});

Deno.test('csrfProtection - invalid CSRF token returns 403', async () => {
  const app = createTestApp({ csrfToken: 'real-session-token-value' });

  const res = await app.request('/api/tenants', {
    method: 'POST',
    headers: { 'x-csrf-token': 'forged-token-value' },
  });
  assertEquals(res.status, 403);
});

Deno.test('csrfProtection - valid CSRF token passes through', async () => {
  const token = 'a-valid-csrf-token-stored-in-session';
  const app = createTestApp({ csrfToken: token });

  const res = await app.request('/api/tenants', {
    method: 'POST',
    headers: { 'x-csrf-token': token },
  });
  assertEquals(res.status, 200);
});

// ---------------------------------------------------------------------------
// csrfTokenHandler tests
// ---------------------------------------------------------------------------

Deno.test('csrfTokenHandler - returns a CSRF token as JSON', async () => {
  const app = new Hono<AppEnv>();
  const sessionStore: Record<string, unknown> = {};

  app.use('*', async (c, next) => {
    c.set('session', {
      ...sessionStore,
      get csrfToken() { return sessionStore.csrfToken as string; },
      set csrfToken(v: string) { sessionStore.csrfToken = v; },
      save: async () => {},
    } as any);
    await next();
  });

  app.get('/csrf-token', csrfTokenHandler);

  const res = await app.request('/csrf-token');
  assertEquals(res.status, 200);

  const body = await res.json();
  assertEquals(typeof body.csrfToken, 'string');
  assertNotEquals(body.csrfToken.length, 0);
});

Deno.test('csrfTokenHandler - returns existing token if one exists in session', async () => {
  const existingToken = 'existing-token-in-session';
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.set('session', {
      csrfToken: existingToken,
      save: async () => {},
    } as any);
    await next();
  });

  app.get('/csrf-token', csrfTokenHandler);

  const res = await app.request('/csrf-token');
  const body = await res.json();
  assertEquals(body.csrfToken, existingToken);
});
