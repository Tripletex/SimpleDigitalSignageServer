import { Request, Response } from 'express';
import deviceService from '../services/deviceService';
import deviceRepository from '../repositories/deviceRepository';
import deviceRegistrationService from '../services/deviceRegistrationService';
import sequelize from '../config/database';
import { 
    DeviceData, 
    DeviceRegistrationRequest, 
    DeviceClaimRequest,
    DeviceCampaignAssignmentRequest 
} from '../../../shared/src/deviceData';
import { handleErrors } from "../helpers/errorHandler";
import { validateAndConvert } from '../validators/validate';
import { deviceDataSchema } from '../validators/deviceDataValidator';
import { deviceRegistrationRequestSchema } from '../validators/deviceRegistrationValidator';
import { deviceClaimSchema, deviceCampaignAssignmentSchema } from '../validators/deviceRegistrationValidator';

class DeviceController {
    /**
     * Register a new device and generate a device ID
     */
    public registerDevice = handleErrors(async (req: Request, res: Response): Promise<void> => {
        const registrationRequest = await validateAndConvert<DeviceRegistrationRequest>(
            req, 
            deviceRegistrationRequestSchema
        );
        
        const result = await deviceRegistrationService.registerDevice(registrationRequest);
        res.status(201).json(result);
    });

    /**
     * Update device last seen status (ping)
     */
    public pingDevice = handleErrors(async (req: Request, res: Response): Promise<void> => {
        const deviceData = await validateAndConvert<DeviceData>(req, deviceDataSchema);
        
        // First, verify the device ID exists and is active
        const deviceRegistration = await deviceRegistrationService.getDeviceById(deviceData.id);
        
        if (!deviceRegistration || deviceRegistration.active !== true) {
            res.status(401).json({ 
                message: 'Invalid or inactive device ID. Please register the device first.' 
            });
            return;
        }
        
        // Import device auth utility for signature verification
        const { verifyDeviceSignature } = await import('../utils/deviceAuth');
        
        // Verify the signature using the device's public key
        const isSignatureValid = verifyDeviceSignature(
            deviceData, 
            deviceRegistration.publicKey
        );
        
        if (!isSignatureValid) {
            res.status(401).json({ 
                message: 'Invalid device signature. Authentication failed.' 
            });
            return;
        }
        
        // Signature verified, update last seen status
        const result = await deviceService.updateLastSeen(deviceData);
        res.status(200).json(result);
    });

    /**
     * Get all devices with ping data
     */
    public getAllDevices = handleErrors(async (req: Request, res: Response): Promise<void> => {
        // Check if we should only return claimed devices (default to true for security)
        const onlyClaimed = req.query.onlyClaimed !== 'false';
        
        // Get raw devices directly from repository to access registrations
        const devices = onlyClaimed 
            ? await deviceRepository.getClaimedDevices() 
            : await deviceRepository.getDevices();
        
        // Map devices with their registration data to include lastSeen and registrationTime
        const devicesWithRegistrations = devices.map(device => {
            const registration = device.registrations?.[0];
            return {
                deviceData: deviceService.mapDeviceToShared(device),
                lastSeen: registration?.lastSeen || new Date(),
                registrationTime: registration?.registrationTime || new Date()
            };
        });
        
        res.status(200).json(devicesWithRegistrations);
    });

    /**
     * Get a specific device by ID
     */
    public getDeviceById = handleErrors(async (req: Request, res: Response): Promise<void> => {
        const { id } = req.params;
        // Get raw device directly from repository to access registrations
        const device = await deviceRepository.getDeviceById(id);
        
        // Include registration data
        const deviceWithRegistration = {
            deviceData: deviceService.mapDeviceToShared(device),
            lastSeen: device.registrations?.[0]?.lastSeen || new Date(),
            registrationTime: device.registrations?.[0]?.registrationTime || new Date()
        };
        
        res.status(200).json(deviceWithRegistration);
    });
    
    /**
     * Get all registered devices (with or without ping data)
     */
    public getAllRegisteredDevices = handleErrors(async (req: Request, res: Response): Promise<void> => {
        const devices = await deviceRegistrationService.getAllRegisteredDevices();
        res.status(200).json(devices);
    });
    
    /**
     * Get devices for the current tenant
     */
    public getTenantDevices = handleErrors(async (req: Request, res: Response): Promise<void> => {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Authentication required' });
            return;
        }
        
        const { tenantId } = req.params;
        
        // Get raw devices directly from repository to access registrations
        const devices = await deviceRepository.getDevicesByTenant(tenantId);
        
        // Map devices with their registration data to include lastSeen and registrationTime
        const devicesWithRegistrations = devices.map(device => {
            const registration = device.registrations?.[0];
            return {
                deviceData: deviceService.mapDeviceToShared(device),
                lastSeen: registration?.lastSeen || new Date(),
                registrationTime: registration?.registrationTime || new Date()
            };
        });
        
        res.status(200).json({
            success: true,
            devices: devicesWithRegistrations
        });
    });
    
    /**
     * Claim a device for a tenant
     */
    public claimDevice = handleErrors(async (req: Request, res: Response): Promise<void> => {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Authentication required' });
            return;
        }
        
        const { tenantId } = req.params;
        const claimRequest = await validateAndConvert<DeviceClaimRequest>(req, deviceClaimSchema);
        
        const result = await deviceService.claimDevice(
            claimRequest.deviceId,
            tenantId,
            req.user.id,
            claimRequest.displayName
        );
        
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    });
    
    /**
     * Release a device from a tenant
     */
    public releaseDevice = handleErrors(async (req: Request, res: Response): Promise<void> => {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Authentication required' });
            return;
        }
        
        const { tenantId, deviceId } = req.params;
        console.log(`[RELEASE DEVICE] Releasing device ${deviceId} from tenant ${tenantId}`);
        
        // First check if device exists and belongs to this tenant
        try {
            const device = await deviceRepository.getDeviceById(deviceId);
            console.log(`[RELEASE DEVICE] Current device state:`, {
                deviceId: device.id,
                tenantId: device.tenantId,
                claimedById: device.claimedById
            });
            
            if (device.tenantId !== tenantId) {
                console.log(`[RELEASE DEVICE] Device does not belong to tenant ${tenantId}`);
                res.status(400).json({ 
                    success: false, 
                    message: `Device does not belong to tenant ${tenantId}` 
                });
                return;
            }
        } catch (error) {
            console.log(`[RELEASE DEVICE] Error getting device:`, error);
            res.status(404).json({ 
                success: false, 
                message: `Device not found: ${error instanceof Error ? error.message : String(error)}` 
            });
            return;
        }
        
        // Proceed with release
        const result = await deviceService.releaseDevice(
            deviceId,
            tenantId,
            req.user.id
        );
        
        // Log the result for debugging
        console.log(`[RELEASE DEVICE] Release result:`, result);
        
        if (result.success) {
            // Double-check the device state after release
            try {
                const device = await deviceRepository.getDeviceById(deviceId);
                console.log(`[RELEASE DEVICE] Device state after release:`, {
                    deviceId: device.id,
                    tenantId: device.tenantId,
                    claimedById: device.claimedById
                });
                
                // If the tenantId is still set, something went wrong
                if (device.tenantId) {
                    console.log(`[RELEASE DEVICE] WARNING: Device still has tenantId after release!`);
                    
                    // Force update the device directly as a fallback
                    const forceResult = await deviceRepository.forceReleaseDevice(deviceId);
                    console.log(`[RELEASE DEVICE] Force release result: ${forceResult ? 'Success' : 'Failed'}`);
                    
                    // Verify the force update worked
                    const updatedDevice = await deviceRepository.getDeviceById(deviceId);
                    console.log(`[RELEASE DEVICE] Device state after force release:`, {
                        deviceId: updatedDevice.id,
                        tenantId: updatedDevice.tenantId,
                        claimedById: updatedDevice.claimedById
                    });
                    
                    // If the device still has a tenantId, something is seriously wrong
                    if (updatedDevice.tenantId) {
                        console.log(`[RELEASE DEVICE] CRITICAL ERROR: Device still has tenantId after force release!`);
                        // Try one more approach: direct SQL query without Sequelize
                        try {
                            // Use imported sequelize instance for direct SQL query 
                            // (SQL NULL is used here since it's raw SQL, not TypeScript)
                            await sequelize.query(
                                `UPDATE devices SET tenant_id = NULL, claimed_by_id = NULL, claimed_at = NULL, display_name = NULL, campaign_id = NULL WHERE id = :deviceId`,
                                { replacements: { deviceId } }
                            );
                            console.log(`[RELEASE DEVICE] Executed direct SQL query as last resort`);
                        } catch (sqlError) {
                            console.error(`[RELEASE DEVICE] Error executing direct SQL:`, sqlError);
                        }
                    }
                }
            } catch (error) {
                console.log(`[RELEASE DEVICE] Error checking device after release:`, error);
            }
            
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    });

    /**
     * Assign a campaign to a device
     */
    public assignCampaign = handleErrors(async (req: Request, res: Response): Promise<void> => {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Authentication required' });
            return;
        }
        
        const { tenantId, deviceId } = req.params;
        const assignmentRequest = await validateAndConvert<DeviceCampaignAssignmentRequest>(
            req, 
            deviceCampaignAssignmentSchema
        );
        
        // Make sure the device ID in the path matches the one in the body
        if (deviceId !== assignmentRequest.deviceId) {
            res.status(400).json({ 
                success: false, 
                message: 'Device ID in path does not match device ID in request body' 
            });
            return;
        }
        
        const result = await deviceService.assignCampaign(
            deviceId,
            assignmentRequest.campaignId,
            tenantId,
            req.user.id
        );
        
        if (result.success) {
            res.status(200).json(result);
        } else {
            res.status(400).json(result);
        }
    });
}

export default new DeviceController();