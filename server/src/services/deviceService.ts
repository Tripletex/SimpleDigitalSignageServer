// services/deviceService.ts
import {DeviceData, DeviceRegistration} from '../../../shared/src/deviceData'; // Assuming you have a DeviceData model

class DeviceService {
    private devices: Map<string, DeviceRegistration>;

    constructor() {
        this.devices = new Map();
    }

    register = async (deviceData: DeviceData) => {
        const registrationTime = new Date();
        this.devices.set(deviceData.id, { registrationTime, deviceData });

        return {message: 'Device registered successfully'};
    };

    getDevices = async () => {
        return Array.from(this.devices.values());
    }
}

export default new DeviceService();