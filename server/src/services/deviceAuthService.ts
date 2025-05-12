import deviceAuthRepository from '../repositories/deviceAuthRepository';
import deviceRegistrationService from './deviceRegistrationService';
import deviceApiKeyRepository from '../repositories/deviceApiKeyRepository';
import { verifyDeviceSignature, generateChallenge } from '../utils/deviceAuth';
import {
  DeviceAuthenticationChallenge,
  DeviceAuthenticationResponse
} from '../../../shared/src/deviceData';

class DeviceAuthService {
  /**
   * Generate a new authentication challenge for a device
   * @param deviceId The device's unique ID
   * @returns Challenge object or null if device not found
   */
  async generateAuthChallenge(deviceId: string): Promise<DeviceAuthenticationChallenge | null> {
    // First check if the device exists and is active
    const isValidDevice = await deviceRegistrationService.isValidDeviceId(deviceId);
    
    if (!isValidDevice) {
      return null;
    }
    
    // Create a new challenge
    const challenge = await deviceAuthRepository.createChallenge(deviceId);
    
    return {
      challenge: challenge.challenge,
      deviceId: challenge.deviceId,
      expires: challenge.expires.getTime() // Convert to timestamp
    };
  }
  
  /**
   * Special method for verification with explicit data format (for testing/troubleshooting)
   * @param deviceId The device's unique ID
   * @param challenge The original challenge string
   * @param signature The signature of the challenge
   * @param explicitData The exact data string that was signed
   * @returns Authentication response
   */
  async verifySignatureWithData(
    deviceId: string,
    challenge: string,
    signature: string,
    explicitData: string
  ): Promise<DeviceAuthenticationResponse> {
    try {
      console.log(`[AUTH] Verifying with explicit data format`);
      console.log(`[AUTH] Data: ${explicitData}`);

      // Get the device's public key
      console.log(`[AUTH] Getting public key for device: ${deviceId}`);
      const publicKey = await deviceAuthRepository.getDevicePublicKey(deviceId);

      if (!publicKey) {
        console.log(`[AUTH] No public key found for device: ${deviceId}`);
        return {
          success: false,
          message: 'Device not found or inactive'
        };
      }

      // Directly verify with the explicit data
      console.log(`[AUTH] Verifying signature with explicit data`);
      const isValid = verifyDeviceSignature(explicitData, signature, publicKey);
      console.log(`[AUTH] Explicit data verification result: ${isValid ? 'VALID' : 'INVALID'}`);

      if (!isValid) {
        return {
          success: false,
          message: 'Invalid signature'
        };
      }

      // Get the challenge record to mark as used
      const challengeRecord = await deviceAuthRepository.getChallenge(deviceId, challenge);
      if (challengeRecord) {
        await deviceAuthRepository.useChallenge(challengeRecord.id);
      }

      // Generate API key
      const { apiKey } = await deviceApiKeyRepository.generateApiKey(deviceId);

      return {
        success: true,
        message: 'Authentication successful',
        apiKey,
        token: undefined, // For backward compatibility, will be removed later
        expires: undefined // For backward compatibility, will be removed later
      };
    } catch (error) {
      console.error(`[AUTH] Error in verifySignatureWithData:`, error);

      // Provide detailed error information
      if (error instanceof Error) {
        console.error(`[AUTH] Error name: ${error.name}`);
        console.error(`[AUTH] Error message: ${error.message}`);
        console.error(`[AUTH] Error stack: ${error.stack}`);
      }

      return {
        success: false,
        message: `Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Verify a challenge response and generate a JWT token if valid
   * @param deviceId The device's unique ID
   * @param challenge The original challenge string
   * @param signature The signature of the challenge
   * @returns Authentication response
   */
  async verifyAuthChallenge(
    deviceId: string,
    challenge: string,
    signature: string
  ): Promise<DeviceAuthenticationResponse> {
    try {
      console.log(`[AUTH] Starting verification for device: ${deviceId}`);
      
      // Get the challenge record
      console.log(`[AUTH] Looking up challenge record for device: ${deviceId}, challenge: ${challenge.substring(0, 20)}...`);
      
      const challengeRecord = await deviceAuthRepository.getChallenge(deviceId, challenge);
      
      if (!challengeRecord) {
        console.log(`[AUTH] Challenge record not found or expired`);
        return {
          success: false,
          message: 'Invalid or expired challenge'
        };
      }
      
      console.log(`[AUTH] Challenge found, ID: ${challengeRecord.id}, expires: ${challengeRecord.expires}`);
      
      // Check if challenge is expired
      const now = new Date();
      if (challengeRecord.expires < now) {
        console.log(`[AUTH] Challenge expired at: ${challengeRecord.expires}, current time: ${now}`);
        return {
          success: false,
          message: 'Challenge expired'
        };
      }
      
      // Get the device's public key
      console.log(`[AUTH] Getting public key for device: ${deviceId}`);
      const publicKey = await deviceAuthRepository.getDevicePublicKey(deviceId);
      
      if (!publicKey) {
        console.log(`[AUTH] No public key found for device: ${deviceId}`);
        return {
          success: false,
          message: 'Device not found or inactive'
        };
      }
      
      console.log(`[AUTH] Found public key (length: ${publicKey.length})`);
      
      // IMPORTANT: Create a data object with the EXACT same format as the client
      // We create multiple format variants and try each one - this allows flexibility
      // in case the client format changes or has different whitespace

      // We'll try all possible formats to find one that works
      let dataString = `{"deviceId":"${deviceId}","challenge":"${challenge}"}`;
      console.log(`[AUTH] Primary data format: ${dataString}`);
      console.log(`[AUTH] Data type: ${typeof dataString}, Length: ${dataString.length}`);
      console.log(`[AUTH] Signature length: ${signature.length}`);

      // Create alternative formats to try if primary fails
      const alternateFormats = [
        JSON.stringify({ deviceId, challenge }),
        `{
  "deviceId": "${deviceId}",
  "challenge": "${challenge}"
}`,
        JSON.stringify({ challenge, deviceId })
      ];

      console.log(`[AUTH] Generated ${alternateFormats.length} alternate formats to try if primary fails`);

      // Dump to temp file for debug (outside nodemon watch path)
      try {
        const fs = require('fs');
        const path = require('path');
        const debugDir = path.join('/tmp', 'signage-debug');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const debugFile = path.join(debugDir, `challenge-${timestamp}.json`);
        fs.writeFileSync(debugFile, dataString);
        console.log(`[AUTH] Challenge data written to: ${debugFile}`);
      } catch (e) {
        console.warn('[AUTH] Could not write debug file:', e);
      }
      
      // Verify the signature with all possible formats
      console.log(`[AUTH] Starting signature verification with multiple format attempts`);

      // Try the primary format first
      let isValid = this.verifySignature(dataString, signature, publicKey);
      console.log(`[AUTH] Primary format verification result: ${isValid ? 'SUCCESS' : 'FAILED'}`);

      // If primary format fails, try alternatives
      let formatIndex = 0;
      while (!isValid && formatIndex < alternateFormats.length) {
        const altFormat = alternateFormats[formatIndex];
        console.log(`[AUTH] Trying alternate format ${formatIndex + 1}: ${altFormat}`);
        isValid = this.verifySignature(altFormat, signature, publicKey);
        console.log(`[AUTH] Format ${formatIndex + 1} result: ${isValid ? 'SUCCESS' : 'FAILED'}`);
        formatIndex++;
      }
      console.log(`[AUTH] Signature verification result: ${isValid ? 'VALID' : 'INVALID'}`);
      
      if (!isValid) {
        return {
          success: false,
          message: 'Invalid signature'
        };
      }
      
      // Mark the challenge as used to prevent replay
      console.log(`[AUTH] Marking challenge as used: ${challengeRecord.id}`);
      await deviceAuthRepository.useChallenge(challengeRecord.id);
      
      // Generate API key
      console.log(`[AUTH] Generating API key for device: ${deviceId}`);
      const { apiKey } = await deviceApiKeyRepository.generateApiKey(deviceId);

      if (!apiKey) {
        console.error(`[AUTH] Failed to generate API key`);
        return {
          success: false,
          message: 'Failed to generate API key'
        };
      }

      console.log(`[AUTH] API key generated successfully`);

      return {
        success: true,
        message: 'Authentication successful',
        apiKey,
        token: undefined, // For backward compatibility, will be removed later
        expires: undefined // For backward compatibility, will be removed later
      };
    } catch (error) {
      console.error(`[AUTH] Error in verifyAuthChallenge:`, error);
      
      // Provide detailed error information
      if (error instanceof Error) {
        console.error(`[AUTH] Error name: ${error.name}`);
        console.error(`[AUTH] Error message: ${error.message}`);
        console.error(`[AUTH] Error stack: ${error.stack}`);
      }
      
      return {
        success: false,
        message: `Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * Verify a challenge signature
   */
  private verifySignature(data: string, signature: string, publicKeyBase64: string): boolean {
    // Use the centralized verification function from deviceAuth.ts
    return verifyDeviceSignature(data, signature, publicKeyBase64);
  }
}

export default new DeviceAuthService();