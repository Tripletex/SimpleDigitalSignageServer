import { env } from '../config/env.ts';

const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // 96-bit IV for AES-GCM
const KEY_LENGTH = 256;

/**
 * Derive an AES-256 key from the encryption secret.
 * Uses PBKDF2 with a fixed salt derived from the secret itself,
 * since the secret should already be high-entropy.
 */
async function getKey(): Promise<CryptoKey> {
  const secret = env.ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error(
      'ENCRYPTION_KEY must be set and at least 32 characters. ' +
      'Generate one with: deno eval "const a=new Uint8Array(32);crypto.getRandomValues(a);console.log(Array.from(a,b=>b.toString(16).padStart(2,\'0\')).join(\'\'))"',
    );
  }

  const encoded = new TextEncoder().encode(secret);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoded,
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoded.slice(0, 16), // Use first 16 bytes of secret as salt
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a plaintext string. Returns a base64-encoded string
 * containing the IV prepended to the ciphertext.
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded,
  );

  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Base64-encode for storage
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a base64-encoded string (IV + ciphertext) back to plaintext.
 */
export async function decrypt(encryptedBase64: string): Promise<string> {
  const key = await getKey();
  const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}
