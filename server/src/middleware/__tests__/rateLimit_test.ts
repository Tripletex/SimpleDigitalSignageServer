/**
 * Tests for rate limiting middleware.
 *
 * Ported from server/src/routes/__tests__/rateLimiting.test.ts
 * Tests that rate limiting is correctly applied to auth and device-auth endpoints.
 *
 * Note: sanitizeResources/sanitizeOps disabled because rateLimit() creates a
 * setInterval for cleanup that is intentionally long-lived.
 */

import { assertEquals, assertNotEquals } from '@std/assert';
import { Hono } from 'hono';
import type { AppEnv } from '../../types/context.ts';
import { rateLimit } from '../rateLimit.ts';

const testOpts = { sanitizeResources: false, sanitizeOps: false };

/** Create a test app with a rate-limited endpoint. */
function createTestApp(config: { windowMs: number; max: number }) {
  const app = new Hono<AppEnv>();

  app.post('/limited', rateLimit(config), (c) => c.json({ ok: true }));
  app.post('/unlimited', (c) => c.json({ ok: true }));

  return app;
}

Deno.test({ name: 'rateLimit - allows requests under the limit', ...testOpts, fn: async () => {
  const app = createTestApp({ windowMs: 60_000, max: 3 });

  const res = await app.request('/limited', {
    method: 'POST',
    headers: { 'x-forwarded-for': '1.2.3.4' },
  });
  assertEquals(res.status, 200);
}});

Deno.test({ name: 'rateLimit - blocks requests over the limit', ...testOpts, fn: async () => {
  const app = createTestApp({ windowMs: 60_000, max: 3 });

  // Send 3 requests (within limit)
  for (let i = 0; i < 3; i++) {
    const res = await app.request('/limited', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });
    assertEquals(res.status, 200, `Request ${i + 1} should succeed`);
  }

  // 4th request should be blocked
  const res = await app.request('/limited', {
    method: 'POST',
    headers: { 'x-forwarded-for': '10.0.0.1' },
  });
  assertEquals(res.status, 429, 'Request over limit should return 429');

  const body = await res.json();
  assertEquals(body.message, 'Too many requests');
}});

Deno.test({ name: 'rateLimit - different IPs have separate limits', ...testOpts, fn: async () => {
  const app = createTestApp({ windowMs: 60_000, max: 2 });

  // Exhaust limit for IP A
  for (let i = 0; i < 2; i++) {
    await app.request('/limited', {
      method: 'POST',
      headers: { 'x-forwarded-for': '192.168.1.1' },
    });
  }

  // IP A is blocked
  const resA = await app.request('/limited', {
    method: 'POST',
    headers: { 'x-forwarded-for': '192.168.1.1' },
  });
  assertEquals(resA.status, 429);

  // IP B should still work
  const resB = await app.request('/limited', {
    method: 'POST',
    headers: { 'x-forwarded-for': '192.168.1.2' },
  });
  assertEquals(resB.status, 200);
}});

Deno.test({ name: 'rateLimit - includes Retry-After header on 429', ...testOpts, fn: async () => {
  const app = createTestApp({ windowMs: 60_000, max: 1 });

  // First request succeeds
  await app.request('/limited', {
    method: 'POST',
    headers: { 'x-forwarded-for': '172.16.0.1' },
  });

  // Second request is rate limited
  const res = await app.request('/limited', {
    method: 'POST',
    headers: { 'x-forwarded-for': '172.16.0.1' },
  });
  assertEquals(res.status, 429);
  assertNotEquals(res.headers.get('retry-after'), null, 'Should include Retry-After header');
}});

Deno.test({ name: 'rateLimit - custom message is returned', ...testOpts, fn: async () => {
  const app = new Hono<AppEnv>();
  app.post(
    '/limited',
    rateLimit({ windowMs: 60_000, max: 1, message: 'Slow down!' }),
    (c) => c.json({ ok: true }),
  );

  await app.request('/limited', {
    method: 'POST',
    headers: { 'x-forwarded-for': '10.10.10.10' },
  });

  const res = await app.request('/limited', {
    method: 'POST',
    headers: { 'x-forwarded-for': '10.10.10.10' },
  });

  const body = await res.json();
  assertEquals(body.message, 'Slow down!');
}});

Deno.test({ name: 'rateLimit - unlimited endpoint is not affected', ...testOpts, fn: async () => {
  const app = createTestApp({ windowMs: 60_000, max: 1 });

  // Multiple requests to unlimited endpoint should all succeed
  for (let i = 0; i < 5; i++) {
    const res = await app.request('/unlimited', {
      method: 'POST',
      headers: { 'x-forwarded-for': '10.20.30.40' },
    });
    assertEquals(res.status, 200, `Unlimited request ${i + 1} should succeed`);
  }
}});
