import { Request, Response } from 'express';
import deviceService from '../services/deviceService';
import deviceRepository from '../repositories/deviceRepository';
import deviceRegistrationService from '../services/deviceRegistrationService';
import { DeviceData, DeviceRegistrationRequest, DeviceClaimRequest } from '../../../shared/src/deviceData';
import { handleErrors } from "../helpers/errorHandler";
import { validateAndConvert } from '../validators/validate';
import { deviceDataSchema } from '../validators/deviceDataValidator';
import { deviceRegistrationRequestSchema } from '../validators/deviceRegistrationValidator';
import { deviceClaimSchema } from '../validators/deviceRegistrationValidator';

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
        
        // Verify the device ID exists and is active
        const isValidDevice = await deviceRegistrationService.isValidDeviceId(deviceData.id);
        
        if (!isValidDevice) {
            res.status(401).json({ 
                message: 'Invalid or inactive device ID. Please register the device first.' 
            });
            return;
        }
        
        const result = await deviceService.updateLastSeen(deviceData);
        res.status(200).json(result);
    });

    /**
     * Get all devices with ping data
     */
    public getAllDevices = handleErrors(async (req: Request, res: Response): Promise<void> => {
        // Get raw devices directly from repository to access registrations
        const devices = await deviceRepository.getDevices();
        
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
        
        const result = await deviceService.releaseDevice(
            deviceId,
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