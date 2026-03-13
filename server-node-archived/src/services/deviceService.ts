// services/deviceService.ts
import {DeviceData, DeviceClaimResponse, DeviceCampaignAssignmentResponse} from '../../../shared/src/deviceData';
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
// Make this function a static method available both on the class and as export
function mapDeviceToSharedInternal(device: Device): DeviceData {
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
        displayName: device.displayName,
        campaignId: device.campaignId
    };
}

// Export the mapping function for use in controllers
export const mapDeviceToShared = mapDeviceToSharedInternal;

class DeviceService {
    // Add as a method for use within the class
    mapDeviceToShared = mapDeviceToSharedInternal;
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
            // First, check if the device exists
            const device = await deviceRepository.getDeviceById(deviceData.id);
            
            // Only allow updates for claimed devices
            if (!device.tenantId) {
                return {
                    message: 'Device ping received, but device is not claimed',
                    unclaimed: true
                };
            }
            
            // For claimed devices, use the repository's dedicated method to update last seen
            const updatedDevice = await deviceRepository.updateLastSeen(deviceData);
            
            // Get the latest registration for the device
            const registration = updatedDevice.registrations?.[0];
            
            return { 
                message: 'Device ping successful',
                lastSeen: registration?.lastSeen || new Date()
            };
        } catch (error: any) {
            // If the device doesn't exist, throw a specific error
            if (error.message?.includes('not found')) {
                throw new Error(`Device with ID ${deviceData.id} not registered. Please register the device first.`);
            }
            
            // Otherwise, re-throw the general error
            console.error('Error updating device last seen:', error);
            throw new Error(`Failed to update device last seen: ${error.message || 'Unknown error'}`);
        }
    };

    getDevices = async () => {
        const devices = await deviceRepository.getDevices();
        return devices.map(device => this.mapDeviceToShared(device));
    }
    
    getClaimedDevices = async () => {
        const devices = await deviceRepository.getClaimedDevices();
        return devices.map(device => this.mapDeviceToShared(device));
    }

    getDeviceById = async (id: string) => {
        const device = await deviceRepository.getDeviceById(id);
        return this.mapDeviceToShared(device);
    }
    
    // Get devices for a specific tenant
    getDevicesByTenant = async (tenantId: string) => {
        const devices = await deviceRepository.getDevicesByTenant(tenantId);
        return devices.map(device => this.mapDeviceToShared(device));
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
                device: this.mapDeviceToShared(claimedDevice)
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
                device: this.mapDeviceToShared(releasedDevice)
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
    
    // Assign a campaign to a device
    assignCampaign = async (
        deviceId: string,
        campaignId: string | null,
        tenantId: string,
        userId: string
    ): Promise<DeviceCampaignAssignmentResponse> => {
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
            
            // Check if the user has permission to configure devices for this tenant
            const membership = await tenantRepository.getTenantMember(tenantId, userId);
            if (!membership) {
                return {
                    success: false,
                    message: `User is not a member of tenant ${tenantId}`
                };
            }
            
            // Only owners and admins can configure devices
            if (membership.role !== TenantRole.OWNER && membership.role !== TenantRole.ADMIN) {
                return {
                    success: false,
                    message: `User does not have permission to configure devices for tenant ${tenantId}`
                };
            }
            
            // If campaign is provided, verify it exists and belongs to the tenant
            if (campaignId) {
                try {
                    const campaign = await import('../repositories/playlistGroupRepository')
                        .then(module => module.default.getPlaylistGroupById(campaignId));
                    
                    if (campaign.tenantId !== tenantId) {
                        return {
                            success: false,
                            message: `Campaign with ID ${campaignId} does not belong to this tenant`
                        };
                    }
                } catch (error) {
                    return {
                        success: false,
                        message: `Campaign with ID ${campaignId} not found`
                    };
                }
            }
            
            // Update the device with the campaign assignment
            const updatedDevice = await deviceRepository.assignCampaign(deviceId, campaignId);
            
            return {
                success: true,
                message: campaignId 
                    ? `Campaign successfully assigned to device` 
                    : `Campaign successfully removed from device`,
                device: this.mapDeviceToShared(updatedDevice)
            };
        } catch (error: any) {
            if (error.message?.includes('not found')) {
                return {
                    success: false,
                    message: `Device with ID ${deviceId} not found`
                };
            }
            
            console.error('Error assigning campaign to device:', error);
            return {
                success: false,
                message: `Failed to assign campaign: ${error.message || 'Unknown error'}`
            };
        }
    }
}

export default new DeviceService();