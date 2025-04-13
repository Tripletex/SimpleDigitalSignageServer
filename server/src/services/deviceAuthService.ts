import deviceAuthRepository from '../repositories/deviceAuthRepository';
import deviceRegistrationService from './deviceRegistrationService';
import { generateDeviceToken, getTokenExpiration } from '../utils/jwt';
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
      
      // Create a data object with the challenge for verification
      const dataToVerify = {
        deviceId,
        challenge
      };
      
      const dataString = JSON.stringify(dataToVerify);
      console.log(`[AUTH] Data to verify: ${dataString}`);
      console.log(`[AUTH] Signature length: ${signature.length}`);
      
      // Verify the signature
      console.log(`[AUTH] Calling verifySignature method`);
      const isValid = this.verifySignature(dataString, signature, publicKey);
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
      
      // Generate JWT token
      console.log(`[AUTH] Generating JWT token for device: ${deviceId}`);
      const token = generateDeviceToken(deviceId);
      const expiresTime = getTokenExpiration(token);
      
      if (!token) {
        console.error(`[AUTH] Failed to generate token`);
        return {
          success: false,
          message: 'Failed to generate authentication token'
        };
      }
      
      console.log(`[AUTH] Token generated successfully, expires: ${expiresTime}`);
      
      return {
        success: true,
        message: 'Authentication successful',
        token,
        // Convert null to undefined to match the expected type
        expires: expiresTime === null ? undefined : expiresTime
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