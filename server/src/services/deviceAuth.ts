import deviceAuthRepository from '../repositories/deviceAuth.ts';
import deviceApiKeyRepository from '../repositories/deviceApiKey.ts';

const deviceAuthService = {
  /**
   * Generate a challenge for device authentication.
   */
  async generateChallenge(deviceId: string) {
    return deviceAuthRepository.createChallenge({ deviceId });
  },

  /**
   * Verify a device authentication challenge using Web Crypto signature verification.
   * If valid, marks the challenge as used and generates an API key.
   */
  async verifyChallenge(
    deviceId: string,
    challenge: string,
    signature: string,
  ) {
    // Get challenge record
    const challengeRecord = await deviceAuthRepository.getChallenge(deviceId, challenge);
    if (!challengeRecord) {
      return { success: false, error: 'Invalid or expired challenge' };
    }

    // Get device public key
    const publicKey = await deviceAuthRepository.getDevicePublicKey(deviceId);
    if (!publicKey) {
      return { success: false, error: 'Device public key not found' };
    }

    // Verify signature using Web Crypto
    const isValid = await verifySignature(publicKey, challenge, signature);
    if (!isValid) {
      return { success: false, error: 'Invalid signature' };
    }

    // Mark challenge as used
    await deviceAuthRepository.useChallenge(challengeRecord.id);

    // Generate API key for the device
    const apiKey = await deviceApiKeyRepository.generateApiKey(deviceId);

    return {
      success: true,
      apiKey: apiKey.plainKey,
      apiKeyId: apiKey.id,
    };
  },

  /**
   * Standalone signature verification using Web Crypto.
   */
  async verifySignature(
    publicKeyPem: string,
    data: string,
    signature: string,
  ): Promise<boolean> {
    return verifySignature(publicKeyPem, data, signature);
  },
};

/**
 * Verify an RSA signature using Web Crypto subtle.verify.
 */
async function verifySignature(
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

    // Verify
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

export default deviceAuthService;
