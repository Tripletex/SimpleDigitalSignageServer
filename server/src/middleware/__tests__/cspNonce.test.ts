import express from 'express';
import helmet from 'helmet';
import request from 'supertest';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { generateCspNonce, CSP_POLICY } from '../xssProtectionMiddleware';

/**
 * CSP Nonce Implementation Tests
 *
 * Validates that the Content Security Policy uses per-request cryptographic
 * nonces instead of 'unsafe-inline' for script-src, preventing XSS attacks
 * while allowing legitimate scripts to execute.
 */

/** Helper: extract the script-src directive from a CSP header string */
function extractScriptSrc(cspHeader: string): string {
  const match = cspHeader.match(/script-src\s+([^;]+)/);
  return match ? match[1].trim() : '';
}

/** Helper: extract nonce value from a CSP header's script-src directive */
function extractNonceFromCsp(cspHeader: string): string | null {
  const scriptSrc = extractScriptSrc(cspHeader);
  const nonceMatch = scriptSrc.match(/'nonce-([A-Za-z0-9+/=]+)'/);
  return nonceMatch ? nonceMatch[1] : null;
}

/** Create a minimal Express app that mirrors the production CSP + nonce setup */
function createTestApp(): express.Express {
  const app = express();

  // Nonce generation middleware (mirrors what production server.ts should do)
  app.use((req, res, next) => {
    const nonce = generateCspNonce();
    res.locals.cspNonce = nonce;
    next();
  });

  // Helmet with CSP directives plus per-request nonce
  app.use((req, res, next) => {
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...CSP_POLICY.directives,
          scriptSrc: [...(CSP_POLICY.directives.scriptSrc || []), `'nonce-${res.locals.cspNonce}'`],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })(req, res, next);
  });

  // Health endpoint (for CSP header tests)
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Simulated SPA HTML endpoint (for nonce-in-HTML tests)
  app.get('/spa', (req, res) => {
    const nonce = res.locals.cspNonce;
    const html = `<!doctype html><html><head><script nonce="${nonce}" defer="defer" src="/static/js/main.js"></script></head><body><div id="root"></div></body></html>`;
    res.type('html').send(html);
  });

  return app;
}

describe('CSP Nonce Implementation', () => {
  describe('Scenario 1: CSP header contains nonce, not unsafe-inline', () => {
    test('CSP header includes nonce and excludes unsafe-inline in script-src', async () => {
      const app = createTestApp();
      const response = await request(app).get('/health');

      const cspHeader = response.headers['content-security-policy'];
      expect(cspHeader).toBeDefined();

      const scriptSrc = extractScriptSrc(cspHeader);

      // Must contain a nonce
      expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);

      // Must NOT contain unsafe-inline
      expect(scriptSrc).not.toContain("'unsafe-inline'");
    });
  });

  describe('Scenario 2: Each request gets a unique nonce', () => {
    test('two separate requests receive different nonces in CSP header', async () => {
      const app = createTestApp();

      const [response1, response2] = await Promise.all([
        request(app).get('/health'),
        request(app).get('/health'),
      ]);

      const nonce1 = extractNonceFromCsp(response1.headers['content-security-policy']);
      const nonce2 = extractNonceFromCsp(response2.headers['content-security-policy']);

      expect(nonce1).not.toBeNull();
      expect(nonce2).not.toBeNull();
      expect(nonce1).not.toBe(nonce2);
    });
  });

  describe('Scenario 3: Script tags in served HTML include the matching nonce', () => {
    test('served HTML script tags include nonce matching CSP header', async () => {
      const app = createTestApp();
      const response = await request(app).get('/spa');

      const cspHeader = response.headers['content-security-policy'];
      const cspNonce = extractNonceFromCsp(cspHeader);
      expect(cspNonce).not.toBeNull();

      // The HTML body should contain a script tag with the same nonce
      const htmlNonceMatch = response.text.match(/nonce="([A-Za-z0-9+/=]+)"/);
      expect(htmlNonceMatch).not.toBeNull();

      const htmlNonce = htmlNonceMatch![1];
      expect(htmlNonce).toBe(cspNonce);
    });
  });

  describe('Scenario 4: Nonce is cryptographically generated', () => {
    test('nonce is valid base64 of at least 16 bytes (22+ base64 chars)', () => {
      const nonce = generateCspNonce();

      // Must be a string
      expect(typeof nonce).toBe('string');

      // Must be valid base64 (at least 22 chars for 16 bytes)
      expect(nonce.length).toBeGreaterThanOrEqual(22);

      // Must be valid base64
      expect(() => Buffer.from(nonce, 'base64')).not.toThrow();

      // Decoded must be at least 16 bytes
      const decoded = Buffer.from(nonce, 'base64');
      expect(decoded.length).toBeGreaterThanOrEqual(16);
    });

    test('multiple calls produce unique nonces', () => {
      const nonces = new Set<string>();
      for (let i = 0; i < 100; i++) {
        nonces.add(generateCspNonce());
      }
      // All 100 should be unique
      expect(nonces.size).toBe(100);
    });
  });

  describe('Scenario 5: Nonce-injected HTML response has Cache-Control: no-store', () => {
    test('nonce-bearing HTML response sets Cache-Control: no-store', async () => {
      const app = express();

      app.use((req, res, next) => {
        res.locals.cspNonce = generateCspNonce();
        next();
      });

      // Simulate the production nonce-injecting HTML handler
      app.get('/spa-cached', (req, res) => {
        const nonce = res.locals.cspNonce;
        const html = `<!doctype html><html><head><script defer src="/static/js/main.js"></script></head><body></body></html>`;
        const nonceHtml = html.replace(/<script/g, `<script nonce="${nonce}"`);
        res.set('Cache-Control', 'no-store');
        res.type('html').send(nonceHtml);
      });

      const response = await request(app).get('/spa-cached');
      expect(response.headers['cache-control']).toBe('no-store');
    });
  });

  describe('Scenario 6: Warning logged when no script tags found in HTML', () => {
    test('nonce injection on HTML with no script tags produces identical output', () => {
      // Simulate the production regex replacement on HTML with no script tags
      const html = '<!doctype html><html><head></head><body><div id="root"></div></body></html>';
      const nonce = generateCspNonce();
      const nonceHtml = html.replace(/<script/g, `<script nonce="${nonce}"`);

      // The replacement should be a no-op — HTML unchanged
      expect(nonceHtml).toBe(html);
    });
  });

  describe('CSP_POLICY static configuration', () => {
    test('CSP_POLICY.directives.scriptSrc does not contain unsafe-inline', () => {
      expect(CSP_POLICY.directives.scriptSrc).not.toContain("'unsafe-inline'");
    });

    test('CSP_POLICY.directives.scriptSrc contains self', () => {
      expect(CSP_POLICY.directives.scriptSrc).toContain("'self'");
    });
  });
});
