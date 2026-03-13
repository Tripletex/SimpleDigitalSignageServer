import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import xss from 'xss';
import validator from 'validator';
import * as he from 'he';

/**
 * XSS Protection and Input Sanitization Middleware
 * 
 * This middleware provides comprehensive protection against XSS attacks by:
 * 1. Sanitizing HTML content in request bodies
 * 2. Encoding dangerous characters
 * 3. Validating and cleaning input data
 * 4. Adding secure response headers
 */

interface SanitizationOptions {
  allowHtml?: boolean;
  maxLength?: number;
  allowUrls?: boolean;
}

/**
 * Default XSS filter configuration
 * Removes script tags, event handlers, and other dangerous elements
 */
const DEFAULT_XSS_OPTIONS = {
  whiteList: {
    // Allow only safe HTML tags for rich text content
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
    h6: []
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style'],
  allowCommentTag: false,
  onIgnoreTagAttr: (tag: string, name: string, value: string) => {
    // Block all event handlers and javascript: URLs
    if (name.toLowerCase().startsWith('on') || 
        value.toLowerCase().includes('javascript:') ||
        value.toLowerCase().includes('vbscript:') ||
        value.toLowerCase().includes('data:')) {
      return '';
    }
  }
};

/**
 * Sanitize a string value based on context and options
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
    // Allow limited HTML but sanitize dangerous content
    sanitized = xss(sanitized, DEFAULT_XSS_OPTIONS);
  } else {
    // Strip all HTML tags and encode entities
    sanitized = validator.stripLow(sanitized);
    sanitized = he.encode(sanitized, { allowUnsafeSymbols: false });
  }

  // URL validation if URLs are expected
  if (options.allowUrls && sanitized.includes('://')) {
    // Validate URLs and only allow safe protocols
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
 * Recursively sanitize an object's properties
 */
function sanitizeObject(obj: any, fieldOptions: Record<string, SanitizationOptions> = {}): any {
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
    return obj.map(item => sanitizeObject(item, fieldOptions));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
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
 * Field-specific sanitization rules for different content types
 */
const FIELD_SANITIZATION_RULES: Record<string, SanitizationOptions> = {
  // User profile fields
  displayName: { maxLength: 100, allowHtml: false },
  email: { maxLength: 254, allowHtml: false },
  name: { maxLength: 100, allowHtml: false },
  
  // Tenant and organization fields
  tenantName: { maxLength: 100, allowHtml: false },
  organizationName: { maxLength: 200, allowHtml: false },
  
  // Content fields that may allow limited HTML
  description: { maxLength: 1000, allowHtml: true },
  notes: { maxLength: 2000, allowHtml: true },
  content: { maxLength: 10000, allowHtml: true },
  
  // URL fields
  url: { maxLength: 2000, allowHtml: false, allowUrls: true },
  imageUrl: { maxLength: 2000, allowHtml: false, allowUrls: true },
  
  // Device and system fields
  deviceName: { maxLength: 100, allowHtml: false },
  playlistName: { maxLength: 200, allowHtml: false },
  
  // Search and filter fields
  search: { maxLength: 200, allowHtml: false },
  filter: { maxLength: 100, allowHtml: false }
};

/**
 * Input sanitization middleware
 * Automatically sanitizes request body based on field types
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  try {
    if (req.body && typeof req.body === 'object') {
      // Apply sanitization to request body
      req.body = sanitizeObject(req.body, FIELD_SANITIZATION_RULES);
      
      // Log sanitization for security monitoring (development only)
      if (process.env.NODE_ENV === 'development') {
        console.log('[XSS-PROTECTION] Request body sanitized for:', req.path);
      }
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      const sanitizedQuery: any = {};
      
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          sanitizedQuery[key] = sanitizeString(value, { maxLength: 200, allowHtml: false });
        } else if (Array.isArray(value)) {
          sanitizedQuery[key] = value.map(v => 
            typeof v === 'string' ? sanitizeString(v, { maxLength: 200, allowHtml: false }) : v
          );
        } else {
          sanitizedQuery[key] = value;
        }
      }
      
      req.query = sanitizedQuery;
    }

    next();
  } catch (error) {
    console.error('[XSS-PROTECTION] Error during input sanitization:', error);
    res.status(400).json({ error: 'Invalid input' });
  }
}

/**
 * Output encoding middleware for API responses
 * Ensures all string values in responses are properly encoded
 */
export function encodeOutput(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json;
  
  res.json = function(body: any) {
    try {
      // Only encode if body contains data that might be displayed to users
      if (body && typeof body === 'object') {
        // Recursively encode string values in the response
        const encodedBody = encodeResponseData(body);
        return originalJson.call(this, encodedBody);
      }
      
      return originalJson.call(this, body);
    } catch (error) {
      console.error('[XSS-PROTECTION] Error during output encoding:', error);
      // Fall back to original response if encoding fails
      return originalJson.call(this, body);
    }
  };
  
  next();
}

/**
 * Recursively encode string values in response data
 */
function encodeResponseData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Only encode if the string contains potentially dangerous characters
    if (/<|>|&|"|'/.test(data)) {
      return he.encode(data, { allowUnsafeSymbols: false });
    }
    return data;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => encodeResponseData(item));
  }

  if (typeof data === 'object') {
    const encoded: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Skip encoding for certain technical fields
      if (SKIP_ENCODING_FIELDS.includes(key)) {
        encoded[key] = value;
      } else {
        encoded[key] = encodeResponseData(value);
      }
    }
    
    return encoded;
  }

  return data;
}

/**
 * Fields that should not be HTML encoded (technical/system fields)
 */
const SKIP_ENCODING_FIELDS = [
  'id',
  'uuid',
  'createdAt',
  'updatedAt',
  'timestamp',
  'token',
  'hash',
  'signature',
  'publicKey',
  'privateKey',
  'challenge',
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
  'method'
];

/**
 * Security headers middleware
 * Adds XSS protection headers to all responses
 */
export function addSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  // XSS Protection header
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Type Options
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Frame Options
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
}

/**
 * Generate a cryptographic nonce for Content Security Policy.
 * Each request gets a unique nonce to allow legitimate scripts
 * while blocking injected inline scripts (XSS defense).
 */
export function generateCspNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Content Security Policy configuration
 *
 * The nonce for scriptSrc is added per-request in server.ts via Helmet's
 * function-based directive support. This base policy intentionally omits
 * 'unsafe-inline' to enforce nonce-only script execution.
 */
export const CSP_POLICY = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"], // Nonce added per-request in server.ts; 'unsafe-inline' removed for XSS defense
    // 'unsafe-inline' required for styleSrc: CRA injects inline <style> tags for CSS modules at runtime.
    // Nonce-based styles would require ejecting CRA or migrating to Vite, which is out of scope.
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
    fontSrc: ["'self'"],
    connectSrc: ["'self'"],
    mediaSrc: ["'self'"],
    objectSrc: ["'none'"],
    childSrc: ["'none'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    upgradeInsecureRequests: [],
  },
};

// Export utility functions for manual sanitization
export { sanitizeString, sanitizeObject, FIELD_SANITIZATION_RULES };