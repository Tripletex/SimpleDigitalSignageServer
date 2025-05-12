import { DeviceApiKey } from '../models/DeviceApiKey';
import { Device } from '../models/Device';
import { generateUUID } from '../utils/helpers';
import crypto from 'crypto';

class DeviceApiKeyRepository {
  /**
   * Generate a new API key for a device
   */
  async generateApiKey(deviceId: string, tenantId?: string, expiresInDays?: number): Promise<{apiKey: string}> {
    // Calculate expiration date if provided
    let expiresAt = undefined;
    if (expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }
    
    // Generate a secure random API key
    const apiKey = crypto.randomBytes(32).toString('hex');
    
    // Create API key in database
    await DeviceApiKey.create({
      id: generateUUID(),
      deviceId,
      tenantId,
      apiKey,
      expiresAt,
      active: true,
      lastUsed: new Date()
    });
    
    return { apiKey };
  }
  
  /**
   * Find an API key by its value
   */
  async findByApiKey(apiKey: string): Promise<DeviceApiKey | null> {
    return await DeviceApiKey.findOne({
      where: { 
        apiKey,
        active: true
      },
      include: [
        {
          model: Device,
          as: 'device'
        }
      ]
    });
  }
  
  /**
   * Get all API keys for a device
   */
  async getApiKeysByDeviceId(deviceId: string): Promise<DeviceApiKey[]> {
    return await DeviceApiKey.findAll({
      where: { deviceId }
    });
  }
  
  /**
   * Validate an API key and return the associated device ID
   */
  async validateApiKey(apiKey: string): Promise<string | null> {
    const keyRecord = await this.findByApiKey(apiKey);
    
    if (!keyRecord) {
      return null;
    }
    
    // Check if expired
    if (keyRecord.isExpired()) {
      return null;
    }
    
    // Update last used timestamp
    await keyRecord.updateLastUsed();
    
    // Return the device ID
    return keyRecord.deviceId;
  }
  
  /**
   * Revoke (deactivate) an API key
   */
  async revokeApiKey(apiKey: string): Promise<boolean> {
    const keyRecord = await this.findByApiKey(apiKey);
    
    if (!keyRecord) {
      return false;
    }
    
    // Mark as inactive
    keyRecord.active = false;
    await keyRecord.save();
    
    return true;
  }
  
  /**
   * Revoke all API keys for a device
   */
  async revokeAllApiKeysForDevice(deviceId: string): Promise<number> {
    const result = await DeviceApiKey.update(
      { active: false },
      { where: { deviceId } }
    );
    
    return result[0]; // Number of affected rows
  }
}

export default new DeviceApiKeyRepository();