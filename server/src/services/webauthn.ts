import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { decodeBase64, encodeBase64 } from '@std/encoding/base64';
import { webAuthnConfig } from '../config/webauthn.ts';

const webauthnService = {
  /**
   * Generate registration options for a user.
   */
  async generateRegistrationOpts(
    user: { id: string; email: string; displayName?: string },
    existingAuthenticators: Array<{
      credentialId: string;
      transports?: string;
    }>,
  ) {
    const excludeCredentials = existingAuthenticators.map((auth) => ({
      id: auth.credentialId,
      transports: auth.transports
        ? (auth.transports.split(',') as AuthenticatorTransportFuture[])
        : undefined,
    }));

    const options = await generateRegistrationOptions({
      rpName: webAuthnConfig.rpName,
      rpID: webAuthnConfig.rpID,
      userID: new TextEncoder().encode(user.id),
      userName: user.email,
      userDisplayName: user.displayName || user.email,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        requireResidentKey: true,
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      timeout: 60000,
    });

    return options;
  },

  /**
   * Verify a registration response.
   */
  async verifyRegistration(
    response: RegistrationResponseJSON,
    expectedChallenge: string,
  ) {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: webAuthnConfig.origin,
      expectedRPID: webAuthnConfig.rpID,
    });

    return verification;
  },

  /**
   * Generate authentication options.
   */
  async generateAuthenticationOpts(
    authenticators: Array<{
      credentialId: string;
      transports?: string;
    }>,
  ) {
    const allowCredentials = authenticators.map((auth) => ({
      id: auth.credentialId,
      transports: auth.transports
        ? (auth.transports.split(',') as AuthenticatorTransportFuture[])
        : undefined,
    }));

    const options = await generateAuthenticationOptions({
      rpID: webAuthnConfig.rpID,
      timeout: 60000,
      allowCredentials,
      userVerification: 'preferred',
    });

    return options;
  },

  /**
   * Verify an authentication response.
   */
  async verifyAuthentication(
    response: AuthenticationResponseJSON,
    expectedChallenge: string,
    authenticator: {
      credentialId: string;
      publicKey: string;
      counter: string;
      transports?: string;
    },
  ) {
    const publicKeyBytes = decodeBase64(authenticator.publicKey);

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: webAuthnConfig.origin,
      expectedRPID: webAuthnConfig.rpID,
      credential: {
        id: authenticator.credentialId,
        publicKey: publicKeyBytes,
        counter: Number(authenticator.counter),
        transports: authenticator.transports
          ? (authenticator.transports.split(',') as AuthenticatorTransportFuture[])
          : undefined,
      },
    });

    return verification;
  },

  /**
   * Format a verified credential for database storage.
   * Converts Uint8Array publicKey to base64 string.
   */
  formatAuthenticatorForStorage(credential: {
    id: string;
    publicKey: Uint8Array;
    counter: number;
    deviceType?: string;
    transports?: AuthenticatorTransportFuture[];
  }) {
    return {
      credentialId: credential.id,
      publicKey: encodeBase64(credential.publicKey),
      counter: String(credential.counter),
      deviceType: credential.deviceType ?? 'unknown',
      transports: credential.transports?.join(','),
    };
  },
};

export default webauthnService;
