// services/deviceService.ts
import { DeviceData, DeviceClaimResponse } from '../../../shared/src/deviceData';
import deviceRepository from '../repositories/deviceRepository';
import tenantRepository from '../repositories/tenantRepository';
import { TenantRole } from '../../../shared/src/tenantData';
import { Device } from '../models/Device';
import { DeviceNetwork } from '../models/DeviceNetwork';
import { DeviceRegistration } from '../models/DeviceRegistration';
import { generateUUID } from '../utils/helpers';

/**
 * Convert model device to shared DeviceData type
 */
function mapDeviceToShared(device: Device): DeviceData {
    // Extract networks data
    const networks = device.networks?.map(network => ({
        name: network.name,
        ipAddress: network.ipAddresses
    })) || [];
    
    return {
        id: device.id,
        name: device.name,
        networks,
        tenantId: device.tenantId,
        claimedBy: device.claimedById,
        claimedAt: device.claimedAt,
        displayName: device.displayName
    };
}

class DeviceService {
    register = async (deviceData: DeviceData) => {
        try {
            // Use the device repository's dedicated method that handles all the device creation logic
            const device = await deviceRepository.updateLastSeen(deviceData);
            return { message: 'Device registered successfully' };
        } catch (error: any) {
            console.error('Error registering device:', error);
            throw new Error(`Failed to register device: ${error.message || 'Unknown error'}`);
        }
    };

    updateLastSeen = async (deviceData: DeviceData) => {
        try {
            // Use the device repository's dedicated method that handles all the update logic
            const updatedDevice = await deviceRepository.updateLastSeen(deviceData);
            
            // Get the latest registration for the device
            const registration = updatedDevice.registrations?.[0];
            
            return { 
                message: 'Device ping successful',
                lastSeen: registration?.lastSeen || new Date()
            };
        } catch (error: any) {
            // If the device doesn't exist, register it
            if (error.message?.includes('not found')) {
                return this.register(deviceData);
            }
            
            // Otherwise, re-throw the error
            console.error('Error updating device last seen:', error);
            throw new Error(`Failed to update device last seen: ${error.message || 'Unknown error'}`);
        }
    };

    getDevices = async () => {
        const devices = await deviceRepository.getDevices();
        return devices.map(device => mapDeviceToShared(device));
    }

    getDeviceById = async (id: string) => {
        const device = await deviceRepository.getDeviceById(id);
        return mapDeviceToShared(device);
    }
    
    // Get devices for a specific tenant
    getDevicesByTenant = async (tenantId: string) => {
        const devices = await deviceRepository.getDevicesByTenant(tenantId);
        return devices.map(device => mapDeviceToShared(device));
    }

    // Claim a device for a tenant
    claimDevice = async (
        deviceId: string, 
        tenantId: string, 
        userId: string, 
        displayName?: string
    ): Promise<DeviceClaimResponse> => {
        try {
            // Check if the device exists
            const device = await deviceRepository.getDeviceById(deviceId);
            
            // Check if already claimed
            if (device.tenantId) {
                return {
                    success: false,
                    message: `Device with ID ${deviceId} is already claimed`
                };
            }
            
            // Check if the user has permission to claim devices for this tenant
            const membership = await tenantRepository.getTenantMember(tenantId, userId);
            if (!membership) {
                return {
                    success: false,
                    message: `User is not a member of tenant ${tenantId}`
                };
            }
            
            // Only owners and admins can claim devices
            if (membership.role !== TenantRole.OWNER && membership.role !== TenantRole.ADMIN) {
                return {
                    success: false,
                    message: `User does not have permission to claim devices for tenant ${tenantId}`
                };
            }
            
            // Update the device using repository's method
            const claimedDevice = await deviceRepository.claimDevice(
                deviceId,
                tenantId,
                userId,
                displayName
            );
            
            return {
                success: true,
                message: `Device successfully claimed for tenant ${tenantId}`,
                device: mapDeviceToShared(claimedDevice)
            };
        } catch (error: any) {
            if (error.message?.includes('not found')) {
                return {
                    success: false,
                    message: `Device with ID ${deviceId} not found`
                };
            }
            
            console.error('Error claiming device:', error);
            return {
                success: false,
                message: `Failed to claim device: ${error.message || 'Unknown error'}`
            };
        }
    }
    
    // Release a claimed device
    releaseDevice = async (
        deviceId: string, 
        tenantId: string, 
        userId: string
    ): Promise<DeviceClaimResponse> => {
        try {
            // Check if the device exists
            const device = await deviceRepository.getDeviceById(deviceId);
            
            // Check if the device is claimed by this tenant
            if (device.tenantId !== tenantId) {
                return {
                    success: false,
                    message: `Device is not claimed by tenant ${tenantId}`
                };
            }
            
            // Check if the user has permission to release devices for this tenant
            const membership = await tenantRepository.getTenantMember(tenantId, userId);
            if (!membership) {
                return {
                    success: false,
                    message: `User is not a member of tenant ${tenantId}`
                };
            }
            
            // Only owners and admins can release devices
            if (membership.role !== TenantRole.OWNER && membership.role !== TenantRole.ADMIN) {
                return {
                    success: false,
                    message: `User does not have permission to release devices for tenant ${tenantId}`
                };
            }
            
            // Update the device to remove tenant information
            const releasedDevice = await deviceRepository.releaseDevice(deviceId);
            
            return {
                success: true,
                message: `Device successfully released from tenant ${tenantId}`,
                device: mapDeviceToShared(releasedDevice)
            };
        } catch (error: any) {
            if (error.message?.includes('not found')) {
                return {
                    success: false,
                    message: `Device with ID ${deviceId} not found`
                };
            }
            
            console.error('Error releasing device:', error);
            return {
                success: false,
                message: `Failed to release device: ${error.message || 'Unknown error'}`
            };
        }
    }
}

export default new DeviceService();