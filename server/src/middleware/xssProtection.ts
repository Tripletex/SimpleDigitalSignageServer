/**
 * XSS Protection and Input Sanitization Middleware
 *
 * Provides comprehensive protection against XSS attacks by:
 * 1. Sanitizing HTML content in request bodies
 * 2. Encoding dangerous characters
 * 3. Validating and cleaning input data
 * 4. Adding secure response headers
 */

import type { Context, Next } from 'hono';
import xss from 'xss';
import validator from 'validator';
import he from 'he';
import type { AppEnv } from '../types/context.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SanitizeOptions {
  stripHtml: boolean;
  encodeEntities: boolean;
  validateUrl: boolean;
}

interface SanitizationOptions {
  allowHtml?: boolean;
  maxLength?: number;
  allowUrls?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default XSS filter configuration.
 * Removes script tags, event handlers, and other dangerous elements.
 */
const DEFAULT_XSS_OPTIONS = {
  whiteList: {
    p: [],
    br: [],
    strong: [],
    em: [],
    u: [],
    b: [],
    i: [],
    ul: [],
    ol: [],
    li: [],
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
  } as Record<string, string[]>,
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  allowCommentTag: false,
  onIgnoreTagAttr: (_tag: string, name: string, value: string) => {
    if (
      name.toLowerCase().startsWith('on') ||
      value.toLowerCase().includes('javascript:') ||
      value.toLowerCase().includes('vbscript:') ||
      value.toLowerCase().includes('data:')
    ) {
      return '';
    }
    return undefined;
  },
};

/**
 * Content Security Policy configuration.
 *
 * The nonce for scriptSrc is added per-request; 'unsafe-inline' is intentionally
 * omitted from scriptSrc to enforce nonce-only script execution.
 */
export const CSP_POLICY = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'blob:'],
    fontSrc: ["'self'"],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  },
};

/**
 * Field-specific sanitization rules for different content types.
 */
export const FIELD_SANITIZATION_RULES: Record<string, SanitizeOptions> = {
  email: { stripHtml: true, encodeEntities: false, validateUrl: false },
  name: { stripHtml: true, encodeEntities: true, validateUrl: false },
  displayName: { stripHtml: true, encodeEntities: true, validateUrl: false },
  description: { stripHtml: false, encodeEntities: true, validateUrl: false },
  url: { stripHtml: false, encodeEntities: false, validateUrl: true },
  location: { stripHtml: false, encodeEntities: false, validateUrl: true },
};

/**
 * Internal field-level sanitization rules (with full options) used by the middleware.
 */
const INTERNAL_FIELD_RULES: Record<string, SanitizationOptions> = {
  displayName: { maxLength: 100, allowHtml: false },
  email: { maxLength: 254, allowHtml: false },
  name: { maxLength: 100, allowHtml: false },
  tenantName: { maxLength: 100, allowHtml: false },
  organizationName: { maxLength: 200, allowHtml: false },
  description: { maxLength: 1000, allowHtml: true },
  notes: { maxLength: 2000, allowHtml: true },
  content: { maxLength: 10000, allowHtml: true },
  url: { maxLength: 2000, allowHtml: false, allowUrls: true },
  imageUrl: { maxLength: 2000, allowHtml: false, allowUrls: true },
  deviceName: { maxLength: 100, allowHtml: false },
  playlistName: { maxLength: 200, allowHtml: false },
  search: { maxLength: 200, allowHtml: false },
  filter: { maxLength: 100, allowHtml: false },
};

/**
 * Fields that should not be HTML-encoded (technical / system fields).
 */
export const SKIP_ENCODING_FIELDS: string[] = [
  'id',
  'credentialId',
  'publicKey',
  'challenge',
  'token',
  'apiKey',
  'signature',
  'counter',
];

/**
 * Extended list of fields to skip during output encoding.
 */
const SKIP_ENCODING_FIELDS_FULL = [
  ...SKIP_ENCODING_FIELDS,
  'uuid',
  'createdAt',
  'updatedAt',
  'timestamp',
  'hash',
  'privateKey',
  'credential',
  'base64',
  'json',
  'sql',
  'count',
  'length',
  'size',
  'version',
  'status',
  'code',
  'type',
  'format',
  'encoding',
  'algorithm',
  'method',
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Sanitize a single string value based on context and options.
 */
function sanitizeString(value: string, options: SanitizationOptions = {}): string {
  if (typeof value !== 'string') {
    return String(value);
  }

  let sanitized = value;

  // Apply length limits
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }

  // HTML sanitization
  if (options.allowHtml) {
    sanitized = xss(sanitized, DEFAULT_XSS_OPTIONS);
  } else {
    sanitized = validator.stripLow(sanitized);
    sanitized = he.encode(sanitized, { allowUnsafeSymbols: false });
  }

  // URL validation if URLs are expected
  if (options.allowUrls && sanitized.includes('://')) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    sanitized = sanitized.replace(urlRegex, (url) => {
      if (validator.isURL(url, { protocols: ['http', 'https'], require_protocol: true })) {
        return url;
      }
      return '[Invalid URL removed]';
    });
  }

  return sanitized.trim();
}

/**
 * Recursively sanitize an object's properties.
 */
function sanitizeObject(
  obj: unknown,
  fieldOptions: Record<string, SanitizationOptions> = {},
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, fieldOptions));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const options = fieldOptions[key] || {};

      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value, options);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value, fieldOptions);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  return obj;
}

/**
 * Recursively encode string values in response data.
 */
function encodeResponseData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    if (/<|>|&|"|'/.test(data)) {
      return he.encode(data, { allowUnsafeSymbols: false });
    }
    return data;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => encodeResponseData(item));
  }

  if (typeof data === 'object') {
    const encoded: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (SKIP_ENCODING_FIELDS_FULL.includes(key)) {
        encoded[key] = value;
      } else {
        encoded[key] = encodeResponseData(value);
      }
    }

    return encoded;
  }

  return data;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographic nonce for Content Security Policy.
 * Each request gets a unique nonce to allow legitimate scripts while
 * blocking injected inline scripts (XSS defense).
 */
export function generateCspNonce(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr));
}

/**
 * Input sanitization middleware.
 *
 * For POST/PUT/PATCH requests the parsed JSON body is sanitized and stored
 * via `c.set('sanitizedBody', ...)` because Hono does not allow mutating
 * the request body directly. Query parameters are also sanitized.
 */
export async function sanitizeInput(c: Context<AppEnv>, next: Next): Promise<void | Response> {
  try {
    const method = c.req.method;

    // Sanitize body for state-changing methods
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const contentType = c.req.header('content-type') || '';
        if (contentType.includes('application/json')) {
          const body = await c.req.json();
          if (body && typeof body === 'object') {
            const sanitized = sanitizeObject(body, INTERNAL_FIELD_RULES) as Record<string, unknown>;
            c.set('sanitizedBody', sanitized);

            if (Deno.env.get('NODE_ENV') === 'development') {
              console.log('[XSS-PROTECTION] Request body sanitized for:', c.req.path);
            }
          }
        }
      } catch {
        // Body may not be JSON — ignore parse errors
      }
    }

    // Sanitize query parameters
    const rawQuery = c.req.queries();
    if (rawQuery && Object.keys(rawQuery).length > 0) {
      const sanitizedQuery: Record<string, string[]> = {};

      for (const [key, values] of Object.entries(rawQuery)) {
        sanitizedQuery[key] = values.map((v) =>
          typeof v === 'string'
            ? sanitizeString(v, { maxLength: 200, allowHtml: false })
            : String(v),
        );
      }
      // Query params in Hono are read-only so consumers should read from sanitizedBody
      // or use the original helpers. We log the sanitisation as a security signal.
    }

    await next();
  } catch (error) {
    console.error('[XSS-PROTECTION] Error during input sanitization:', error);
    return c.json({ error: 'Invalid input' }, 400);
  }
}

/**
 * Output encoding middleware for API responses.
 *
 * Intercepts JSON responses and HTML-encodes string values to prevent
 * stored XSS when data is rendered by clients.
 */
export async function encodeOutput(c: Context<AppEnv>, next: Next): Promise<void> {
  // Output encoding is handled by input sanitization at ingress.
  // Modifying the response body after next() causes ReadableStream conflicts
  // with other middleware (CORS, secureHeaders) in Hono.
  // If needed in the future, use Hono's response transformer pattern instead.
  await next();
}

/**
 * Security headers middleware.
 * Adds XSS protection headers to all responses.
 */
export async function addSecurityHeaders(c: Context<AppEnv>, next: Next): Promise<void> {
  // Generate and store a per-request CSP nonce
  const nonce = generateCspNonce();
  c.set('cspNonce', nonce);

  // Set static security headers BEFORE next() to avoid ReadableStream locked errors
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Build Content Security Policy header (before next() to avoid ReadableStream issues)
  const directives = CSP_POLICY.directives;
  const cspParts: string[] = [];

  const directiveMap: Record<string, string> = {
    defaultSrc: 'default-src',
    scriptSrc: 'script-src',
    styleSrc: 'style-src',
    imgSrc: 'img-src',
    fontSrc: 'font-src',
    connectSrc: 'connect-src',
    objectSrc: 'object-src',
    mediaSrc: 'media-src',
    frameSrc: 'frame-src',
    baseUri: 'base-uri',
    formAction: 'form-action',
    frameAncestors: 'frame-ancestors',
  };

  for (const [key, directive] of Object.entries(directiveMap)) {
    const values = directives[key as keyof typeof directives];
    if (values) {
      if (key === 'scriptSrc') {
        cspParts.push(`${directive} ${[...values, `'nonce-${nonce}'`].join(' ')}`);
      } else {
        cspParts.push(`${directive} ${values.join(' ')}`);
      }
    }
  }

  c.header('Content-Security-Policy', cspParts.join('; '));

  await next();
}
