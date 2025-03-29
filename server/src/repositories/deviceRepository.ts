import { Device } from '../models/Device';
import { DeviceNetwork } from '../models/DeviceNetwork';
import { DeviceRegistration } from '../models/DeviceRegistration';
import { Tenant } from '../models/Tenant';
import { User } from '../models/User';
import { generateUUID } from '../utils/helpers';
import { Op } from 'sequelize';

class DeviceRepository {
  /**
   * Update device last seen status
   */
  async updateLastSeen(deviceData: {
    id: string;
    name: string;
    networks: { name: string; ipAddress: string[] }[];
  }): Promise<Device> {
    // First, find or create the device
    let device = await Device.findByPk(deviceData.id);
    
    if (!device) {
      // Create the device if it doesn't exist
      device = await Device.create({
        id: deviceData.id,
        name: deviceData.name
      });
    } else {
      // Update the device name if it's changed
      if (device.name !== deviceData.name) {
        device.name = deviceData.name;
        await device.save();
      }
    }
    
    // Update device registration or create a new one
    let registration = await DeviceRegistration.findOne({
      where: { deviceId: deviceData.id }
    });
    
    if (!registration) {
      registration = await DeviceRegistration.create({
        id: generateUUID(),
        deviceId: deviceData.id,
        registrationTime: new Date(),
        lastSeen: new Date()
      });
    } else {
      registration.lastSeen = new Date();
      await registration.save();
    }
    
    // Update networks
    if (deviceData.networks && deviceData.networks.length > 0) {
      // Get existing networks for comparison
      const existingNetworks = await DeviceNetwork.findAll({
        where: { deviceId: deviceData.id }
      });
      
      // Process each network
      for (const network of deviceData.networks) {
        // Check if network exists
        let existingNetwork = existingNetworks.find(n => n.name === network.name);
        
        if (existingNetwork) {
          // Update IP addresses if they've changed
          if (JSON.stringify(existingNetwork.ipAddresses) !== JSON.stringify(network.ipAddress)) {
            existingNetwork.ipAddresses = network.ipAddress;
            await existingNetwork.save();
          }
        } else {
          // Create new network
          await DeviceNetwork.create({
            id: generateUUID(),
            deviceId: deviceData.id,
            name: network.name,
            ipAddresses: network.ipAddress
          });
        }
      }
      
      // Remove networks that no longer exist
      const currentNetworkNames = deviceData.networks.map(n => n.name);
      const networksToRemove = existingNetworks.filter(n => !currentNetworkNames.includes(n.name));
      
      for (const network of networksToRemove) {
        await network.destroy();
      }
    }
    
    // Return the updated device with all relationships
    return await this.getDeviceById(deviceData.id);
  }
  
  /**
   * Get a specific device by ID
   */
  async getDeviceById(id: string): Promise<Device> {
    const device = await Device.findByPk(id, {
      include: [
        {
          model: DeviceNetwork,
          as: 'networks'
        },
        {
          model: DeviceRegistration,
          as: 'registrations'
        },
        {
          model: Tenant
        },
        {
          model: User,
          as: 'claimedBy'
        }
      ]
    });
    
    if (!device) {
      throw new Error(`Device with ID ${id} not found`);
    }
    
    return device;
  }
  
  /**
   * Get all devices
   */
  async getDevices(): Promise<Device[]> {
    return await Device.findAll({
      include: [
        {
          model: DeviceNetwork,
          as: 'networks'
        },
        {
          model: DeviceRegistration,
          as: 'registrations'
        },
        {
          model: Tenant
        },
        {
          model: User,
          as: 'claimedBy'
        }
      ]
    });
  }
  
  /**
   * Get devices for a specific tenant
   */
  async getDevicesByTenant(tenantId: string): Promise<Device[]> {
    return await Device.findAll({
      where: { tenantId },
      include: [
        {
          model: DeviceNetwork,
          as: 'networks'
        },
        {
          model: DeviceRegistration,
          as: 'registrations'
        },
        {
          model: Tenant
        },
        {
          model: User,
          as: 'claimedBy'
        }
      ]
    });
  }
  
  /**
   * Claim a device for a tenant
   */
  async claimDevice(
    deviceId: string,
    tenantId: string,
    userId: string,
    displayName?: string
  ): Promise<Device> {
    // Find the device
    const device = await Device.findByPk(deviceId);
    
    if (!device) {
      throw new Error(`Device with ID ${deviceId} not found`);
    }
    
    // Check if already claimed
    if (device.tenantId) {
      throw new Error(`Device with ID ${deviceId} is already claimed`);
    }
    
    // Update the device
    device.tenantId = tenantId;
    device.claimedById = userId;
    device.claimedAt = new Date();
    
    if (displayName) {
      device.displayName = displayName;
    }
    
    await device.save();
    
    // Return the updated device
    return await this.getDeviceById(deviceId);
  }
  
  /**
   * Release a device from a tenant
   */
  async releaseDevice(deviceId: string): Promise<Device> {
    // Find the device
    const device = await Device.findByPk(deviceId);
    
    if (!device) {
      throw new Error(`Device with ID ${deviceId} not found`);
    }
    
    // Update the device
    device.tenantId = undefined;
    device.claimedById = undefined;
    device.claimedAt = undefined;
    device.displayName = undefined;
    
    await device.save();
    
    // Return the updated device
    return await this.getDeviceById(deviceId);
  }
  
  /**
   * Save a device (generic method for all device updates)
   */
  async saveDevice(device: Device): Promise<Device> {
    await device.save();
    return await this.getDeviceById(device.id);
  }
}

export default new DeviceRepository();