import type { DeviceCredentials, ClientConfig } from '../types.ts';
import { storage } from '../system/storage.ts';
import { ApiClient } from './client.ts';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function loadCredentials(config: ClientConfig): Promise<DeviceCredentials | null> {
  return storage.readJson<DeviceCredentials>(`${config.configDir}/credentials.json`);
}

async function saveCredentials(config: ClientConfig, creds: DeviceCredentials): Promise<void> {
  await storage.writeJson(`${config.configDir}/credentials.json`, creds);
}

async function generateKeyPair(): Promise<{ publicKeyBase64: string; privateKeyJwk: JsonWebKey }> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true, // extractable
    ['sign', 'verify'],
  );

  const publicKeySpki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyBase64 = arrayBufferToBase64(publicKeySpki);

  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  return { publicKeyBase64, privateKeyJwk };
}

async function loadPrivateKey(config: ClientConfig): Promise<CryptoKey | null> {
  const jwk = await storage.readJson<JsonWebKey>(`${config.configDir}/private_key.jwk`);
  if (!jwk) return null;

  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function signChallenge(privateKey: CryptoKey, challenge: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(challenge);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, data);
  return arrayBufferToBase64(signature);
}

export async function ensureCredentials(
  config: ClientConfig,
  client: ApiClient,
  forceRegister = false,
): Promise<DeviceCredentials> {
  if (!forceRegister) {
    const existing = await loadCredentials(config);
    if (existing) {
      console.log(`[AUTH] Loaded existing credentials for device ${existing.deviceId}`);
      return existing;
    }
  }

  console.log(`[AUTH] ${forceRegister ? 'Re-registering' : 'No credentials found, registering new'} device...`);

  // Generate key pair
  const { publicKeyBase64, privateKeyJwk } = await generateKeyPair();

  // Save private key
  await storage.writeJson(`${config.configDir}/private_key.jwk`, privateKeyJwk);

  // Get hostname for device type
  let hostname = 'signage-client';
  try {
    hostname = Deno.hostname();
  } catch {
    // hostname() may not be available
  }

  // Register with server
  const result = await client.register(publicKeyBase64, 'signage-client', hostname);

  const creds: DeviceCredentials = {
    deviceId: result.id,
    apiKey: result.apiKey,
    serverUrl: config.serverUrl,
    registeredAt: result.registrationTime,
  };

  await saveCredentials(config, creds);
  console.log(`[AUTH] Registered as device ${creds.deviceId}`);

  return creds;
}

export async function reAuthenticate(
  config: ClientConfig,
  client: ApiClient,
  deviceId: string,
): Promise<string> {
  console.log('[AUTH] Re-authenticating via challenge-response...');

  const privateKey = await loadPrivateKey(config);
  if (!privateKey) {
    throw new Error('No private key found, cannot re-authenticate');
  }

  // Request challenge
  const { challenge } = await client.requestChallenge(deviceId);

  // Sign challenge
  const signature = await signChallenge(privateKey, challenge);

  // Verify and get new API key
  const result = await client.verifyChallenge(deviceId, challenge, signature);
  if (!result.success || !result.apiKey) {
    throw new Error('Challenge-response authentication failed');
  }

  // Update stored credentials
  const creds = await loadCredentials(config);
  if (creds) {
    creds.apiKey = result.apiKey;
    await saveCredentials(config, creds);
  }

  console.log('[AUTH] Re-authentication successful, new API key obtained');
  return result.apiKey;
}
