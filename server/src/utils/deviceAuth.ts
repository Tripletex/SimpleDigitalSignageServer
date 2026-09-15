/**
 * Verify an RSA signature using Web Crypto subtle.verify (RSASSA-PKCS1-v1_5 with SHA-256).
 */
export async function verifySignature(
  publicKeyPem: string,
  data: string,
  signatureBase64: string,
): Promise<boolean> {
  try {
    // Extract PEM content and decode to binary
    const pemContent = publicKeyPem
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\s/g, '');
    const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));

    // Import the public key
    const cryptoKey = await crypto.subtle.importKey(
      'spki',
      binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    // Decode signature and encode data
    const signatureBytes = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
    const dataBytes = new TextEncoder().encode(data);

    // Verify the signature
    const isValid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signatureBytes,
      dataBytes,
    );

    return isValid;
  } catch (error) {
    console.error('[DeviceAuth] Signature verification failed:', error);
    return false;
  }
}

/**
 * Generate a cryptographically random challenge string.
 */
export function generateChallenge(): string {
  return crypto.randomUUID();
}
