/**
 * Device Authentication Controller
 *
 * Handles device authentication via challenge-response protocol.
 */

import type { Context } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { env } from '../config/env.ts';
import deviceAuthRepository from '../repositories/deviceAuth.ts';
import deviceRegistrationRepository from '../repositories/deviceRegistration.ts';

/**
 * Generate an authentication challenge for a device
 */
export async function generateChallenge(c: Context<AppEnv>): Promise<Response> {
  const body = (c.get('sanitizedBody') || await c.req.json()) as { deviceId: string };
  const { deviceId } = body;

  if (!deviceId) {
    return c.json({
      success: false,
      message: 'Device ID is required',
    }, 400);
  }

  console.log(`[AUTH] Generating challenge for device: ${deviceId}`);

  // Validate device exists
  const isValid = await deviceRegistrationRepository.isValidDeviceId(deviceId);
  if (!isValid) {
    return c.json({
      success: false,
      message: 'Device not found or inactive',
    }, 404);
  }

  const challenge = await deviceAuthRepository.createChallenge({ deviceId });

  return c.json({
    success: true,
    challenge: challenge.challenge,
    deviceId,
    expires: challenge.expires,
  });
}

/**
 * Verify a challenge response and issue an API key
 */
export async function verifyChallenge(c: Context<AppEnv>): Promise<Response> {
  console.log('[AUTH] Received verify challenge request');

  const body = (c.get('sanitizedBody') || await c.req.json()) as { deviceId: string; challenge: string; signature: string };

  if (!body || typeof body !== 'object') {
    return c.json({
      success: false,
      message: 'Invalid request format: JSON object expected',
    }, 400);
  }

  const { deviceId, challenge, signature } = body;

  if (!deviceId) {
    return c.json({ success: false, message: 'Device ID is required' }, 400);
  }
  if (!challenge) {
    return c.json({ success: false, message: 'Challenge is required' }, 400);
  }
  if (!signature) {
    return c.json({ success: false, message: 'Signature is required' }, 400);
  }

  console.log(`[AUTH] Verifying challenge for device: ${deviceId}`);

  // Retrieve and mark the challenge as used
  const challengeRecord = await deviceAuthRepository.getChallenge(deviceId, challenge);
  if (!challengeRecord) {
    return c.json({
      success: false,
      message: 'Invalid or expired challenge',
    }, 401);
  }

  // Get device's public key
  const publicKey = await deviceAuthRepository.getDevicePublicKey(deviceId);
  if (!publicKey) {
    return c.json({
      success: false,
      message: 'Device public key not found',
    }, 401);
  }

  // Verify the signature using Web Crypto API
  try {
    const rawData = `{"deviceId":"${deviceId}","challenge":"${challenge}"}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(rawData);
    const signatureBytes = Uint8Array.from(atob(signature), (ch) => ch.charCodeAt(0));

    // Import the public key
    const pemKey = publicKey.includes('BEGIN PUBLIC KEY')
      ? publicKey
      : `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;

    const pemBody = pemKey
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '');
    const keyBytes = Uint8Array.from(atob(pemBody), (ch) => ch.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      'spki',
      keyBytes,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const verified = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signatureBytes,
      data,
    );

    if (verified) {
      // Mark challenge as used
      await deviceAuthRepository.useChallenge(challengeRecord.id);

      // Generate API key
      const { default: deviceApiKeyRepository } = await import('../repositories/deviceApiKey.ts');
      const apiKeyResult = await deviceApiKeyRepository.generateApiKey(deviceId);

      console.log(`[AUTH] Verification successful for device ${deviceId}`);
      return c.json({
        success: true,
        message: 'Authentication successful',
        token: apiKeyResult.plainKey,
      });
    }

    console.log(`[AUTH] Verification failed for device ${deviceId}`);
    return c.json({
      success: false,
      message: 'Signature verification failed',
    }, 401);
  } catch (error) {
    console.error('[AUTH] Verification error:', error);
    return c.json({
      success: false,
      message: 'Error verifying authentication challenge',
      ...(env.isDev && { error: error instanceof Error ? error.message : 'Unknown error' }),
    }, 500);
  }
}

/**
 * DEBUG ONLY: Direct verification endpoint that takes raw data and signature
 * SECURITY: Only available in development environment
 */
export async function debugVerify(c: Context<AppEnv>): Promise<Response> {
  if (!env.isDev) {
    return c.json({ success: false, message: 'Not found' }, 404);
  }

  const body = (c.get('sanitizedBody') || await c.req.json()) as { rawData: string; signature: string; publicKeyBase64: string };
  const { rawData, signature, publicKeyBase64 } = body;

  if (!rawData || !signature || !publicKeyBase64) {
    return c.json({
      success: false,
      message: 'Raw data, signature, and publicKeyBase64 are required',
    }, 400);
  }

  console.log(`[AUTH DEBUG] Received direct verification request`);

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(rawData);
    const signatureBytes = Uint8Array.from(atob(signature), (ch) => ch.charCodeAt(0));

    // Decode public key
    const publicKeyPem = new TextDecoder().decode(
      Uint8Array.from(atob(publicKeyBase64), (ch) => ch.charCodeAt(0)),
    );
    const pemBody = publicKeyPem
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .replace(/\s/g, '');
    const keyBytes = Uint8Array.from(atob(pemBody), (ch) => ch.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      'spki',
      keyBytes,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const result = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signatureBytes,
      data,
    );

    console.log(`[AUTH DEBUG] Direct verification result: ${result ? 'SUCCESS' : 'FAILURE'}`);
    return c.json({
      success: result,
      message: result ? 'Verification successful' : 'Verification failed',
    });
  } catch (error) {
    console.error(`[AUTH DEBUG] Verification error:`, error);
    return c.json({
      success: false,
      message: `Verification error: ${error instanceof Error ? error.message : String(error)}`,
    }, 500);
  }
}
