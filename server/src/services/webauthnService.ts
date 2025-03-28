import { 
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';

import { webAuthnConfig } from '../config/webauthn';
import userRepository from '../repositories/userRepository';
import { User, Authenticator } from '../../../shared/src/userData';

// Helper to convert base64url to buffer
function base64UrlToBuffer(base64url: string): Uint8Array {
  return Buffer.from(base64url.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// Helper to convert buffer to base64url
function bufferToBase64Url(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

class WebAuthnService {
  /**
   * Generate registration options for a new authenticator
   */
  async generateRegistrationOptions(userId: string, email: string, displayName: string): Promise<any> {
    // Get user's existing authenticators
    const user = await userRepository.getUserById(userId);
    const userAuthenticators = user?.authenticators || [];
    
    // Prepare the authenticator list for the options generation
    const excludeCredentials = userAuthenticators.map(auth => ({
      id: auth.credentialID,
      type: 'public-key' as const,
    })) as any;
    
    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName: webAuthnConfig.rpName,
      rpID: webAuthnConfig.rpID,
      userID: Buffer.from(userId),
      userName: email,
      userDisplayName: displayName,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        requireResidentKey: true,
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      timeout: 60000, // 1 minute
    });
    
    return options;
  }

  /**
   * Verify registration response and save authenticator
   */
  async verifyRegistration(
    userId: string,
    response: any,
    challenge: string
  ): Promise<any> {
    try {
      console.log('WebAuthn verifyRegistration - userId:', userId);
      console.log('WebAuthn verifyRegistration - challenge:', challenge);
      console.log('WebAuthn verifyRegistration - response received:', JSON.stringify(response, null, 2));
      
      // Log WebAuthn configuration
      console.log('WebAuthn config:', {
        expectedOrigin: webAuthnConfig.origin,
        expectedRPID: webAuthnConfig.rpID
      });
      
      // SimpleWebAuthn library expects:
      // 1. id and rawId as base64url strings (NOT buffers)
      // 2. attestationObject and clientDataJSON as base64url strings (NOT buffers)
      // The library does the conversions internally
      
      // Make sure the registration response is exactly as the library expects
      const verificationResponse = {
        id: response.id,
        rawId: response.rawId,
        response: {
          attestationObject: response.response.attestationObject,
          clientDataJSON: response.response.clientDataJSON
        },
        type: response.type,
        clientExtensionResults: response.clientExtensionResults || {}
      };
      
      console.log('Sending verification response to SimpleWebAuthn:', JSON.stringify(verificationResponse, null, 2));
      
      // Verify the attestation with NO transformations
      const verification = await verifyRegistrationResponse({
        response: verificationResponse,
        expectedChallenge: challenge,
        expectedOrigin: webAuthnConfig.origin,
        expectedRPID: webAuthnConfig.rpID,
        requireUserVerification: true,
      });
      
      // If verification successful, save the authenticator
      if (verification.verified) {
        // Extract data from verification
        const registrationInfo = verification.registrationInfo as any;
        const { credentialID, credentialPublicKey, counter } = registrationInfo;
        
        // Create a new authenticator object
        const newAuthenticator: Authenticator = {
          credentialID: bufferToBase64Url(credentialID),
          credentialPublicKey: bufferToBase64Url(credentialPublicKey),
          counter,
          credentialDeviceType: response.authenticatorAttachment || 'platform',
          credentialBackedUp: false,
          transports: response.transports || [],
        };
        
        await userRepository.addAuthenticator(userId, newAuthenticator);
      }
      
      return verification;
    } catch (error) {
      console.error('Registration verification error:', error);
      return { verified: false, error: String(error) };
    }
  }

  /**
   * Generate authentication options
   */
  async generateAuthenticationOptions(email?: string): Promise<any> {
    let allowCredentials: any[] | undefined;
    
    // If email is provided, get authenticators for that user
    if (email) {
      const user = await userRepository.getUserByEmail(email);
      
      if (user && user.authenticators && user.authenticators.length > 0) {
        allowCredentials = user.authenticators.map(authenticator => ({
          id: authenticator.credentialID,
          type: 'public-key' as const,
        }));
      }
    }
    
    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID: webAuthnConfig.rpID,
      allowCredentials,
      userVerification: 'preferred',
      timeout: 60000,
    } as any);
    
    return options;
  }

  /**
   * Verify authentication response
   */
  async verifyAuthentication(
    response: any,
    challenge: string
  ): Promise<{ verified: boolean; user: User | null }> {
    try {
      console.log('WebAuthn verifyAuthentication - challenge:', challenge);
      console.log('WebAuthn verifyAuthentication - response:', JSON.stringify(response, null, 2));
      
      // Get authenticator by credential ID
      const authenticator = await userRepository.getAuthenticatorByCredentialId(
        response.id
      );
      
      // If authenticator doesn't exist, verification fails
      if (!authenticator) {
        console.log('Authenticator not found for ID:', response.id);
        return { verified: false, user: null };
      }

      // Find the user who owns this authenticator
      const user = await userRepository.getUserById(authenticator.userId);
      if (!user) {
        console.log('User not found for authenticator:', authenticator);
        return { verified: false, user: null };
      }
      
      console.log('Found user for authentication:', user.email);
      
      // For authentication, we don't need to modify the response
      // The SimpleWebAuthn library expects base64url strings and does conversions itself
      const verificationResponse = {
        id: response.id,
        rawId: response.rawId,
        response: {
          clientDataJSON: response.response.clientDataJSON,
          authenticatorData: response.response.authenticatorData,
          signature: response.response.signature,
          userHandle: response.response.userHandle
        },
        type: response.type,
        clientExtensionResults: response.clientExtensionResults || {}
      };
      
      console.log('Sending authentication response to SimpleWebAuthn:', JSON.stringify(verificationResponse, null, 2));
      
      // Verify the assertion
      const verification = await verifyAuthenticationResponse({
        response: verificationResponse,
        expectedChallenge: challenge,
        expectedOrigin: webAuthnConfig.origin,
        expectedRPID: webAuthnConfig.rpID,
        authenticator: {
          credentialID: base64UrlToBuffer(authenticator.credentialID),
          credentialPublicKey: base64UrlToBuffer(authenticator.credentialPublicKey),
          counter: authenticator.counter,
        },
        requireUserVerification: true,
      } as any);
      
      // If verification successful, update the authenticator counter
      if (verification.verified) {
        const authenticationInfo = verification.authenticationInfo as any;
        await userRepository.updateAuthenticatorCounter(
          authenticator.credentialID,
          authenticationInfo.newCounter
        );
      }
      
      return { verified: verification.verified, user };
    } catch (error) {
      console.error('Authentication verification error:', error);
      return { verified: false, user: null };
    }
  }
}

export default new WebAuthnService();