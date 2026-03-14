// WebAuthn helper functions

/**
 * Convert a base64 or base64url string to a Uint8Array
 */
export function base64ToArrayBuffer(base64: string): Uint8Array {
  // Convert base64url to base64
  const base64Formatted = base64
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
  
  try {
    const binaryString = atob(base64Formatted);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error('Error decoding base64:', error, base64);
    throw error;
  }
}

/**
 * Convert a Uint8Array to a base64url string (safe for URLs and JSON)
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // Create base64url format (URL-safe)
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Prepare options for WebAuthn registration
 */
export function prepareRegistrationOptions(options: any): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: base64ToArrayBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64ToArrayBuffer(options.user.id),
    },
    excludeCredentials: (options.excludeCredentials || []).map((cred: any) => ({
      ...cred,
      id: base64ToArrayBuffer(cred.id),
    })),
  } as PublicKeyCredentialCreationOptions;
}

/**
 * Prepare options for WebAuthn authentication
 */
export function prepareAuthenticationOptions(options: any): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: base64ToArrayBuffer(options.challenge),
    allowCredentials: (options.allowCredentials || []).map((cred: any) => ({
      ...cred,
      id: base64ToArrayBuffer(cred.id),
    })),
  } as PublicKeyCredentialRequestOptions;
}

/**
 * Prepare registration response for sending to server
 */
export function prepareRegistrationResponse(credential: PublicKeyCredential): any {
  const response = credential.response as AuthenticatorAttestationResponse;
  
  return {
    id: credential.id,
    rawId: arrayBufferToBase64(credential.rawId),
    response: {
      attestationObject: arrayBufferToBase64(response.attestationObject),
      clientDataJSON: arrayBufferToBase64(response.clientDataJSON),
    },
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: 'platform', // Default to platform
  };
}

/**
 * Prepare authentication response for sending to server
 */
export function prepareAuthenticationResponse(credential: PublicKeyCredential): any {
  const response = credential.response as AuthenticatorAssertionResponse;
  
  return {
    id: credential.id,
    rawId: arrayBufferToBase64(credential.rawId),
    response: {
      authenticatorData: arrayBufferToBase64(response.authenticatorData),
      clientDataJSON: arrayBufferToBase64(response.clientDataJSON),
      signature: arrayBufferToBase64(response.signature),
      userHandle: response.userHandle ? arrayBufferToBase64(response.userHandle) : null,
    },
    type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}