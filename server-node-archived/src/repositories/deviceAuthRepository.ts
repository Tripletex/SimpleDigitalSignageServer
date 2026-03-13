import { DeviceAuthChallenge } from '../models/DeviceAuthChallenge';
import { DeviceRegistration } from '../models/DeviceRegistration';
import { Device } from '../models/Device';
import { generateUUID } from '../utils/helpers';
import { generateChallenge } from '../utils/deviceAuth';

class DeviceAuthRepository {
  /**
   * Create a new challenge for device authentication
   */
  async createChallenge(deviceId: string, expiresInMinutes: number = 5): Promise<{
    id: string;
    challenge: string;
    deviceId: string;
    expires: Date;
  }> {
    // Generate a random challenge string
    const challenge = generateChallenge();
    
    // Calculate expiration time
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + expiresInMinutes);
    
    // Create challenge record (no tenantId initially)
    const challengeRecord = await DeviceAuthChallenge.create({
      id: generateUUID(),
      deviceId,
      challenge,
      expires,
      used: false,
      tenantId: null // explicitly set to null for initial challenge
    });
    
    return {
      id: challengeRecord.id,
      challenge: challengeRecord.challenge,
      deviceId: challengeRecord.deviceId,
      expires: challengeRecord.expires
    };
  }
  
  /**
   * Get an unused, non-expired challenge
   */
  async getChallenge(deviceId: string, challenge: string): Promise<DeviceAuthChallenge | null> {
    const now = new Date();
    
    return await DeviceAuthChallenge.findOne({
      where: {
        deviceId,
        challenge,
        used: false,
        expires: {
          [Symbol.for('gt')]: now // Greater than current time (not expired)
        }
      }
    });
  }
  
  /**
   * Mark a challenge as used
   */
  async useChallenge(id: string): Promise<boolean> {
    const challenge = await DeviceAuthChallenge.findByPk(id);
    
    if (!challenge) {
      return false;
    }
    
    challenge.used = true;
    await challenge.save();
    return true;
  }
  
  /**
   * Get a device's public key for verification
   */
  async getDevicePublicKey(deviceId: string): Promise<string | null> {
    const registration = await DeviceRegistration.findOne({
      where: { deviceId, active: true }
    });
    
    return registration ? registration.publicKey : null;
  }
  
  /**
   * Clean up expired challenges
   */
  async cleanupExpiredChallenges(): Promise<number> {
    const now = new Date();
    
    const { count } = await DeviceAuthChallenge.destroy({
      where: {
        expires: {
          [Symbol.for('lt')]: now // Less than current time (expired)
        }
      }
    }).then(count => ({ count }));
    
    return count;
  }
}

export default new DeviceAuthRepository();