import { DeviceApiKey } from '../models/DeviceApiKey';
import { Device } from '../models/Device';
import { generateUUID } from '../utils/helpers';
import crypto from 'crypto';

/** Compute a SHA-256 hex digest of a plaintext API key. */
function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

class DeviceApiKeyRepository {
  /**
   * Generate a new API key for a device.
   * The plaintext key is returned once and never stored.
   */
  async generateApiKey(deviceId: string, tenantId?: string, expiresInDays?: number): Promise<{apiKey: string}> {
    // Calculate expiration date if provided
    let expiresAt = undefined;
    if (expiresInDays !== undefined && expiresInDays !== null) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Generate a secure random API key
    const apiKey = crypto.randomBytes(32).toString('hex');
    const apiKeyHash = hashApiKey(apiKey);

    // Store only the hash in the database
    await DeviceApiKey.create({
      id: generateUUID(),
      deviceId,
      tenantId,
      apiKeyHash,
      expiresAt,
      active: true,
      lastUsed: new Date()
    });

    // Return the plaintext key (shown to user only once)
    return { apiKey };
  }
  
  /**
   * Find an API key record by its plaintext value.
   * Hashes the input and queries against the stored hash.
   */
  async findByApiKey(apiKey: string): Promise<DeviceApiKey | null> {
    const apiKeyHash = hashApiKey(apiKey);
    return await DeviceApiKey.findOne({
      where: {
        apiKeyHash,
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