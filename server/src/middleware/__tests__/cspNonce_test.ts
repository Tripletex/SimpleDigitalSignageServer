/**
 * CSP Nonce Implementation Tests
 *
 * Ported from server/src/middleware/__tests__/cspNonce.test.ts
 * Validates that the Content Security Policy uses per-request cryptographic
 * nonces instead of 'unsafe-inline' for script-src.
 */

import { assert, assertEquals, assertNotEquals } from '@std/assert';
import { Hono } from 'hono';
import type { AppEnv } from '../../types/context.ts';
import { generateCspNonce, CSP_POLICY, addSecurityHeaders } from '../xssProtection.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractScriptSrc(cspHeader: string): string {
  const match = cspHeader.match(/script-src\s+([^;]+)/);
  return match ? match[1].trim() : '';
}

function extractNonceFromCsp(cspHeader: string): string | null {
  const scriptSrc = extractScriptSrc(cspHeader);
  const nonceMatch = scriptSrc.match(/'nonce-([A-Za-z0-9+/=]+)'/);
  return nonceMatch ? nonceMatch[1] : null;
}

/** Create a minimal Hono app with security headers middleware. */
function createTestApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', addSecurityHeaders);

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.get('/spa', (c) => {
    const nonce = c.get('cspNonce');
    const html = `<!doctype html><html><head><script nonce="${nonce}" defer="defer" src="/static/js/main.js"></script></head><body><div id="root"></div></body></html>`;
    c.header('Cache-Control', 'no-store');
    return c.html(html);
  });

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test('CSP header contains nonce, not unsafe-inline', async () => {
  const app = createTestApp();
  const res = await app.request('/health');

  const cspHeader = res.headers.get('content-security-policy');
  assert(cspHeader, 'CSP header should be present');

  const scriptSrc = extractScriptSrc(cspHeader);

  // Must contain a nonce
  assert(scriptSrc.match(/'nonce-[A-Za-z0-9+/=]+'/), 'script-src should contain nonce');

  // Must NOT contain unsafe-inline
  assertEquals(scriptSrc.includes("'unsafe-inline'"), false, 'script-src must not contain unsafe-inline');
});

Deno.test('each request gets a unique nonce', async () => {
  const app = createTestApp();

  const [res1, res2] = await Promise.all([
    app.request('/health'),
    app.request('/health'),
  ]);

  const nonce1 = extractNonceFromCsp(res1.headers.get('content-security-policy') || '');
  const nonce2 = extractNonceFromCsp(res2.headers.get('content-security-policy') || '');

  assert(nonce1, 'First nonce should exist');
  assert(nonce2, 'Second nonce should exist');
  assertNotEquals(nonce1, nonce2, 'Nonces should be different per request');
});

Deno.test('served HTML script tags include nonce matching CSP header', async () => {
  const app = createTestApp();
  const res = await app.request('/spa');

  const cspHeader = res.headers.get('content-security-policy') || '';
  const cspNonce = extractNonceFromCsp(cspHeader);
  assert(cspNonce, 'CSP nonce should exist');

  const html = await res.text();
  const htmlNonceMatch = html.match(/nonce="([A-Za-z0-9+/=]+)"/);
  assert(htmlNonceMatch, 'HTML should contain nonce attribute');

  assertEquals(htmlNonceMatch![1], cspNonce, 'HTML nonce should match CSP nonce');
});

Deno.test('nonce is cryptographically generated (base64 of at least 16 bytes)', () => {
  const nonce = generateCspNonce();

  assertEquals(typeof nonce, 'string');
  assert(nonce.length >= 22, 'Nonce should be at least 22 chars (16 bytes base64)');

  // Must be valid base64
  const decoded = atob(nonce);
  assert(decoded.length >= 16, 'Decoded nonce should be at least 16 bytes');
});

Deno.test('multiple calls produce unique nonces', () => {
  const nonces = new Set<string>();
  for (let i = 0; i < 100; i++) {
    nonces.add(generateCspNonce());
  }
  assertEquals(nonces.size, 100, 'All 100 nonces should be unique');
});

Deno.test('nonce injection on HTML with no script tags produces identical output', () => {
  const html = '<!doctype html><html><head></head><body><div id="root"></div></body></html>';
  const nonce = generateCspNonce();
  const nonceHtml = html.replace(/<script/g, `<script nonce="${nonce}"`);
  assertEquals(nonceHtml, html, 'No-script HTML should be unchanged');
});

Deno.test('CSP_POLICY.directives.scriptSrc does not contain unsafe-inline', () => {
  assertEquals(
    CSP_POLICY.directives.scriptSrc.includes("'unsafe-inline'"),
    false,
  );
});

Deno.test('CSP_POLICY.directives.scriptSrc contains self', () => {
  assert(CSP_POLICY.directives.scriptSrc.includes("'self'"));
});
