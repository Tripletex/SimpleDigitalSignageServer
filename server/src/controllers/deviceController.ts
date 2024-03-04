import { Request, Response } from 'express'; // Correct import for Request and Response
import deviceService from '../services/deviceService';
import { DeviceData } from '../../../shared/src/deviceData';
import {handleErrors} from "../helpers/errorHandler";
import { validateAndConvert } from '../validators/validate';
import { deviceDataSchema } from '../validators/deviceDataValidator';

class DeviceController {

    public registerDevice = handleErrors(async (req : Request, res : Response) => {
        const deviceData = await validateAndConvert<DeviceData>(req, deviceDataSchema);
        const result = await deviceService.register(deviceData);
        res.status(200).json(result);
    });

    public getAllDevices = handleErrors(async (req : Request, res : Response) => {
        const devices = await deviceService.getDevices();
        res.status(200).json(devices);
    });
}

export default new DeviceController();