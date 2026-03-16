/**
 * API Key Authentication Middleware
 *
 * Authenticates devices using API keys provided via header, query parameter,
 * or request body.
 */

import type { Context, Next } from 'hono';
import type { AppEnv } from '../types/context.ts';

// Repositories will be created later in the migration; import paths are
// declared here so that wiring is ready once they exist.
import deviceApiKeyRepository from '../repositories/deviceApiKey.ts';
import deviceRepository from '../repositories/device.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeviceInfo {
  id: string;
  tenantId?: string;
}

interface Device {
  id: string;
  tenantId?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the API key from the request.
 * Checks (in order): X-API-Key header, apiKey query param, body field.
 */
async function extractApiKey(c: Context<AppEnv>): Promise<string | undefined> {
  const fromHeader = c.req.header('x-api-key');
  if (fromHeader) return fromHeader;

  const fromQuery = c.req.query('apiKey');
  if (fromQuery) return fromQuery;

  // Try body (only if content-type is JSON)
  try {
    const contentType = c.req.header('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await c.req.json();
      if (body && body.apiKey) return body.apiKey as string;
    }
  } catch {
    // Body may not be parseable — ignore
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Require a valid API key. Returns 401 if missing or invalid, 404 if the
 * associated device cannot be found.
 */
export async function requireApiKey(
  c: Context<AppEnv>,
  next: Next,
): Promise<void | Response> {
  try {
    const apiKey = await extractApiKey(c);

    if (!apiKey) {
      return c.json({ success: false, message: 'API key is required' }, 401);
    }

    const validationResult = await deviceApiKeyRepository.validateApiKey(apiKey);

    if (!validationResult.valid || !validationResult.deviceId) {
      return c.json({ success: false, message: 'Invalid or expired API key' }, 401);
    }

    const device = (await deviceRepository.getDeviceById(validationResult.deviceId)) as Device | null;

    if (!device) {
      return c.json({ success: false, message: 'Device not found' }, 404);
    }

    const deviceInfo: DeviceInfo = {
      id: validationResult.deviceId,
      tenantId: device.tenantId,
    };
    c.set('device', deviceInfo);

    await next();
  } catch (error) {
    console.error('[API-KEY-AUTH] Error validating API key:', error);
    return c.json({ success: false, message: 'Authentication error' }, 500);
  }
}

/**
 * Optional API key authentication.
 * If an API key is present it will be validated and the device info attached.
 * If absent the request continues without error.
 */
export async function optionalApiKey(
  c: Context<AppEnv>,
  next: Next,
): Promise<void | Response> {
  try {
    const apiKey = await extractApiKey(c);

    if (!apiKey) {
      await next();
      return;
    }

    const validationResult = await deviceApiKeyRepository.validateApiKey(apiKey);

    if (validationResult.valid && validationResult.deviceId) {
      const device = (await deviceRepository.getDeviceById(validationResult.deviceId)) as Device | null;

      if (device) {
        const deviceInfo: DeviceInfo = {
          id: validationResult.deviceId,
          tenantId: device.tenantId,
        };
        c.set('device', deviceInfo);
      }
    }

    await next();
  } catch (error) {
    console.error('[API-KEY-AUTH] Error in optional API key validation:', error);
    await next();
  }
}

/**
 * Require either a valid API key or an authenticated user session.
 * The API key is checked first. If absent or invalid, falls back to the session.
 * Returns 401 if neither authentication method succeeds.
 */
export async function requireApiKeyOrAuth(
  c: Context<AppEnv>,
  next: Next,
): Promise<void | Response> {
  // Step 1: Try API key
  try {
    const apiKey = await extractApiKey(c);

    if (apiKey) {
      const validationResult = await deviceApiKeyRepository.validateApiKey(apiKey);

      if (validationResult.valid && validationResult.deviceId) {
        const device = (await deviceRepository.getDeviceById(validationResult.deviceId)) as Device | null;

        if (device) {
          const deviceInfo: DeviceInfo = {
            id: validationResult.deviceId,
            tenantId: device.tenantId,
          };
          c.set('device', deviceInfo);
          await next();
          return;
        }
      }
      // API key provided but invalid — fall through to session check
    }
  } catch (error) {
    console.error('[API-KEY-AUTH] Error in API key validation, falling back to session:', error);
  }

  // Step 2: Check session authentication
  const session = c.get('session');

  if (session && session.userId) {
    c.set('user', {
      id: session.userId as string,
      email: session.username as string,
      role: session.role as string,
    });
    await next();
    return;
  }

  // Step 3: Neither method succeeded
  return c.json(
    { success: false, message: 'Authentication required: provide a valid API key or user session' },
    401,
  );
}
