import deviceAuthRepository from '../repositories/deviceAuthRepository';
import deviceRegistrationService from './deviceRegistrationService';
import { generateDeviceToken, getTokenExpiration } from '../utils/jwt';
import { verifyDeviceSignature } from '../utils/deviceAuth';
import crypto from 'crypto';
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
    // Get the challenge record
    const challengeRecord = await deviceAuthRepository.getChallenge(deviceId, challenge);
    
    if (!challengeRecord) {
      return {
        success: false,
        message: 'Invalid or expired challenge'
      };
    }
    
    // Get the device's public key
    const publicKey = await deviceAuthRepository.getDevicePublicKey(deviceId);
    
    if (!publicKey) {
      return {
        success: false,
        message: 'Device not found or inactive'
      };
    }
    
    // Create a data object with the challenge for verification
    const dataToVerify = {
      deviceId,
      challenge
    };
    
    // Verify the signature
    const isValid = this.verifySignature(JSON.stringify(dataToVerify), signature, publicKey);
    
    if (!isValid) {
      return {
        success: false,
        message: 'Invalid signature'
      };
    }
    
    // Mark the challenge as used to prevent replay
    await deviceAuthRepository.useChallenge(challengeRecord.id);
    
    // Generate JWT token
    const token = generateDeviceToken(deviceId);
    const expiresTime = getTokenExpiration(token);
    
    return {
      success: true,
      message: 'Authentication successful',
      token,
      // Convert null to undefined to match the expected type
      expires: expiresTime === null ? undefined : expiresTime
    };
  }
  
  /**
   * Verify a challenge signature
   */
  private verifySignature(data: string, signature: string, publicKey: string): boolean {
    try {
      // Create a verifier
      const verifier = crypto.createVerify('SHA256');
      verifier.update(data);
      
      // Convert base64 signature to buffer
      const signatureBuffer = Buffer.from(signature, 'base64');
      
      // Convert base64 public key to buffer
      const publicKeyBuffer = Buffer.from(publicKey, 'base64');
      
      // Verify the signature
      return verifier.verify(publicKeyBuffer, signatureBuffer);
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }
}

export default new DeviceAuthService();