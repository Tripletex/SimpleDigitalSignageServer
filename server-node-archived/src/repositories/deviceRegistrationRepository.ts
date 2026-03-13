import { Device } from '../models/Device';
import { DeviceRegistration } from '../models/DeviceRegistration';
import { generateUUID } from '../utils/helpers';

class DeviceRegistrationRepository {
  /**
   * Register a new device
   */
  async registerDevice(
    request: { deviceType?: string; hardwareId?: string; publicKey: string; }
  ): Promise<{ id: string; registrationTime: Date }> {
    console.log('[REGISTER] Starting device registration with public key length:', request.publicKey.length);
    
    try {
      // Generate a unique ID for the device
      const deviceId = generateUUID();
      console.log('[REGISTER] Generated deviceId:', deviceId);
      
      // Create the device
      const device = await Device.create({
        id: deviceId,
        name: `Device-${deviceId.substr(0, 8)}`
      });
      console.log('[REGISTER] Created device record:', device.id);
      
      // Create device registration with public key (no tenantId initially)
      const registration = await DeviceRegistration.create({
        id: generateUUID(),
        deviceId: deviceId,
        deviceType: request.deviceType,
        hardwareId: request.hardwareId,
        publicKey: request.publicKey,
        registrationTime: new Date(),
        lastSeen: new Date(),
        tenantId: null // explicitly set to null for initial registration
      });
      console.log('[REGISTER] Created registration record:', registration.id);
      
      const result = {
        id: deviceId,
        registrationTime: registration.registrationTime
      };
      
      console.log('[REGISTER] Returning result:', result);
      return result;
    } catch (error) {
      console.error('[REGISTER] Error during device registration:', error);
      throw error;
    }
  }
  
  /**
   * Check if a device ID is valid and active
   */
  async isValidDeviceId(deviceId: string): Promise<boolean> {
    const registration = await DeviceRegistration.findOne({
      where: { deviceId }
    });
    
    return !!registration;
  }
  
  /**
   * Get all registered devices
   */
  async getAllRegisteredDevices(): Promise<DeviceRegistration[]> {
    return await DeviceRegistration.findAll({
      include: [
        {
          model: Device,
          include: ['networks']
        }
      ]
    });
  }
  
  /**
   * Get all devices (alias for getAllRegisteredDevices for compatibility)
   */
  async getAllDevices(): Promise<DeviceRegistration[]> {
    return await this.getAllRegisteredDevices();
  }
  
  /**
   * Get registration for a specific device
   */
  async getDeviceRegistration(deviceId: string): Promise<DeviceRegistration | null> {
    return await DeviceRegistration.findOne({
      where: { deviceId },
      include: [
        {
          model: Device,
          include: ['networks']
        }
      ]
    });
  }
  
  /**
   * Get device by ID (alias for getDeviceRegistration for compatibility)
   */
  async getDeviceById(deviceId: string): Promise<DeviceRegistration | null> {
    return await this.getDeviceRegistration(deviceId);
  }
  
  /**
   * Deactivate a device
   */
  async deactivateDevice(deviceId: string): Promise<void> {
    const registration = await DeviceRegistration.findOne({
      where: { deviceId }
    });
    
    if (registration) {
      // Soft delete or mark as inactive
      await registration.update({ active: false });
    }
  }
}

export default new DeviceRegistrationRepository();