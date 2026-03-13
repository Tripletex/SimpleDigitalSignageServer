import { env } from './env.ts';

// Configure WebAuthn settings
export const webAuthnConfig = {
  rpName: 'Digital Signage Server',
  rpID: env.RP_ID,
  origin: env.ORIGIN,
  // 31 days in milliseconds
  timeout: 2592000000,
};

/**
 * Generate a cryptographically secure session secret
 */
function generateSecureSecret(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate session secret strength
 */
function validateSessionSecret(secret: string): boolean {
  // Minimum 32 characters, should not be the old default
  return secret.length >= 32 &&
         secret !== 'digital-signage-secret-key-change-in-production' &&
         secret !== 'your-secret-key-for-sessions';
}

/**
 * Get or generate session secret with proper security validation
 */
function getSessionSecret(): string {
  const envSecret = env.SESSION_SECRET;

  // Production environment requires a strong session secret
  if (env.isProd) {
    if (!envSecret) {
      throw new Error(
        'SESSION_SECRET environment variable is required in production. ' +
        'Generate a strong secret with: deno eval "const a=new Uint8Array(32);crypto.getRandomValues(a);console.log(Array.from(a,b=>b.toString(16).padStart(2,\'0\')).join(\'\'))"'
      );
    }

    if (!validateSessionSecret(envSecret)) {
      throw new Error(
        'SESSION_SECRET must be at least 32 characters long and cannot be the default value. ' +
        'Generate a strong secret with: deno eval "const a=new Uint8Array(32);crypto.getRandomValues(a);console.log(Array.from(a,b=>b.toString(16).padStart(2,\'0\')).join(\'\'))"'
      );
    }

    return envSecret;
  }

  // Development environment: use provided secret or generate a secure one
  if (envSecret && validateSessionSecret(envSecret)) {
    return envSecret;
  }

  // Generate a secure random secret for development
  const generatedSecret = generateSecureSecret();
  console.log(`[SECURITY] Generated secure session secret for development: ${generatedSecret.substring(0, 8)}...`);
  console.log('[SECURITY] For production, set SESSION_SECRET environment variable to a strong random value');

  return generatedSecret;
}

// Session configuration with secure secret validation
export const SESSION_SECRET = getSessionSecret();

// Cookie configuration
export const COOKIE_CONFIG = {
  httpOnly: true,
  sameSite: env.isProd ? 'strict' : 'lax' as const,
  secure: env.isProd,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/',
};
