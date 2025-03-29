// Configure WebAuthn settings
export const webAuthnConfig = {
  rpName: 'Digital Signage Server',
  rpID: process.env.RP_ID || 'localhost',
  origin: process.env.ORIGIN || 'http://localhost:3000',
  // 31 days in milliseconds
  timeout: 2592000000,
};

// Session configuration
export const SESSION_SECRET = process.env.SESSION_SECRET || 'digital-signage-secret-key-change-in-production';

// Cookie configuration
export const COOKIE_CONFIG = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/'
};