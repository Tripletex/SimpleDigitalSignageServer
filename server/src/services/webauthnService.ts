import { 
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifyAuthenticationResponseOpts,
  VerifyRegistrationResponseOpts
} from '@simplewebauthn/server';

import { 
  AuthenticationResponseJSON, 
  RegistrationResponseJSON,
  Base64URLString,
  AuthenticatorTransportFuture
} from '@simplewebauthn/types';

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

// Define credential type for clarity
type WebAuthnCredential = {
  id: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
};

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
      
      // Verify the attestation with any type to get past TypeScript issues
      const opts: any = {
        response: verificationResponse,
        expectedChallenge: challenge,
        expectedOrigin: webAuthnConfig.origin,
        expectedRPID: webAuthnConfig.rpID,
        requireUserVerification: true,
      };
      
      const verification = await verifyRegistrationResponse(opts);
      
      // If verification successful, save the authenticator
      if (verification.verified) {
        // Extract data from verification
        const registrationInfo = verification.registrationInfo as any;
        console.log('Registration info structure:', JSON.stringify(registrationInfo, (key, value) => 
          value instanceof Uint8Array ? `[Uint8Array of length ${value.length}]` : value, 2));
        
        try {
          // In newer versions of SimpleWebAuthn, the data structure has changed
          // These properties are now inside a credential object
          const credentialID = registrationInfo.credential?.id 
            ? base64UrlToBuffer(registrationInfo.credential.id)
            : registrationInfo.credentialID;
            
          const credentialPublicKey = registrationInfo.credential?.publicKey 
            ? registrationInfo.credential.publicKey
            : registrationInfo.credentialPublicKey;
            
          const counter = registrationInfo.credential?.counter ?? registrationInfo.counter ?? 0;
          
          // Validate that we have the required data
          if (!credentialID) {
            throw new Error('CredentialID is missing from registration info');
          }
          
          if (!credentialPublicKey) {
            throw new Error('CredentialPublicKey is missing from registration info');
          }
          
          // Ensure transports are valid by only keeping known transport types
          const validTransports = (response.transports || []).filter((transport: any) => 
            ['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb'].includes(transport)
          ) as any;
          
          // Create a new authenticator object
          const newAuthenticator: Authenticator = {
            credentialID: bufferToBase64Url(credentialID),
            credentialPublicKey: bufferToBase64Url(credentialPublicKey),
            counter,
            credentialDeviceType: response.authenticatorAttachment || 'platform',
            credentialBackedUp: false,
            transports: validTransports,
          };
          
          await userRepository.addAuthenticator(userId, newAuthenticator);
        } catch (error) {
          console.error('Error processing registration info:', error);
          return { verified: false, error: String(error) };
        }
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
      console.log('Authenticator data:', JSON.stringify(authenticator, null, 2));
      
      // Make sure counter is defined - this is critical for authentication
      if (authenticator.counter === undefined) {
        console.error('Authenticator counter is undefined. Setting to 0.');
        authenticator.counter = 0;
        // Update the counter in the database
        await userRepository.updateAuthenticatorCounter(authenticator.credentialID, 0);
      }
      
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
      
      // Explicitly convert authenticator data to the format expected by the library
      // Pay very close attention to the structure required by SimpleWebAuthn 13.1.1
      const credentialIDBuffer = base64UrlToBuffer(authenticator.credentialID);
      const credentialPublicKeyBuffer = base64UrlToBuffer(authenticator.credentialPublicKey);
      
      // Make sure counter is a number
      const counter = typeof authenticator.counter === 'number' ? authenticator.counter : 0;
      
      console.log('Raw credential data:');
      console.log('- credentialID (base64url):', authenticator.credentialID);
      console.log('- credentialPublicKey (base64url):', authenticator.credentialPublicKey);
      console.log('- counter:', counter);
      console.log('- credentialIDBuffer length:', credentialIDBuffer.length);
      console.log('- credentialPublicKeyBuffer length:', credentialPublicKeyBuffer.length);
      
      // Build the exact object structure expected by SimpleWebAuthn
      const authData = {
        credentialID: credentialIDBuffer,
        credentialPublicKey: credentialPublicKeyBuffer,
        counter: counter,
      };
      
      console.log('Authentication data being used for verification:', {
        credentialID: `Uint8Array(${credentialIDBuffer.length})`,
        credentialPublicKey: `Uint8Array(${credentialPublicKeyBuffer.length})`,
        counter: authData.counter
      });
      
      try {
        // Create credential object according to SimpleWebAuthn 13.1.1 requirements
        // Must match WebAuthnCredential type exactly
        // Filter transports to only include valid ones
        const transports = authenticator.transports?.filter((transport: any) => 
          ['ble', 'cable', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb'].includes(transport)
        ) as any;
        
        const credential: WebAuthnCredential = {
          id: authenticator.credentialID,
          publicKey: credentialPublicKeyBuffer,
          counter: counter,
          transports: transports?.length ? transports : undefined,
        };
        
        console.log('Using credential object with properties:', Object.keys(credential));
        
        // Create complete options object with required credential property
        // Use any type for now to get past TypeScript issues
        const verifyOpts: any = {
          response: verificationResponse,
          expectedChallenge: challenge,
          expectedOrigin: webAuthnConfig.origin,
          expectedRPID: webAuthnConfig.rpID,
          requireUserVerification: true,
          credential: {
            id: authenticator.credentialID,
            publicKey: credentialPublicKeyBuffer,
            counter: counter,
          },
        };
        
        const verification = await verifyAuthenticationResponse(verifyOpts);
        
        console.log('Authentication verification result:', verification.verified);
        
        // If verification successful, update the authenticator counter
        if (verification.verified) {
          console.log('Verification successful, authentication info:', verification.authenticationInfo);
          
          // In newer SimpleWebAuthn versions, the authenticationInfo structure may have changed
          const newCounter = 
            verification.authenticationInfo?.newCounter !== undefined 
              ? verification.authenticationInfo.newCounter
              : (authenticator.counter + 1);
              
          console.log(`Updating counter from ${authenticator.counter} to ${newCounter}`);
          
          await userRepository.updateAuthenticatorCounter(
            authenticator.credentialID,
            newCounter
          );
        }
        
        return { verified: verification.verified, user };
      } catch (error) {
        console.error('Authentication verification failed in inner try block:', error);
        console.error('Error stack:', (error as Error).stack);
        return { verified: false, user: null };
      }
    } catch (error) {
      console.error('Authentication verification failed in outer try block:', error);
      console.error('Error stack:', (error as Error).stack);
      return { verified: false, user: null };
    }
  }
}

export default new WebAuthnService();