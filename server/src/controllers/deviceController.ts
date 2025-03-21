import { Request, Response } from 'express';
import deviceService from '../services/deviceService';
import deviceRegistrationService from '../services/deviceRegistrationService';
import { DeviceData, DeviceRegistrationRequest } from '../../../shared/src/deviceData';
import { handleErrors } from "../helpers/errorHandler";
import { validateAndConvert } from '../validators/validate';
import { deviceDataSchema } from '../validators/deviceDataValidator';
import { deviceRegistrationRequestSchema } from '../validators/deviceRegistrationValidator';

class DeviceController {
    /**
     * Register a new device and generate a device ID
     */
    public registerDevice = handleErrors(async (req: Request, res: Response) => {
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
    public pingDevice = handleErrors(async (req: Request, res: Response) => {
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
    public getAllDevices = handleErrors(async (req: Request, res: Response) => {
        const devices = await deviceService.getDevices();
        res.status(200).json(devices);
    });

    /**
     * Get a specific device by ID
     */
    public getDeviceById = handleErrors(async (req: Request, res: Response) => {
        const { id } = req.params;
        const device = await deviceService.getDeviceById(id);
        
        if (!device) {
            res.status(404).json({ message: 'Device not found' });
            return;
        }
        
        res.status(200).json(device);
    });
    
    /**
     * Get all registered devices (with or without ping data)
     */
    public getAllRegisteredDevices = handleErrors(async (req: Request, res: Response) => {
        const devices = await deviceRegistrationService.getAllRegisteredDevices();
        res.status(200).json(devices);
    });
}

export default new DeviceController();