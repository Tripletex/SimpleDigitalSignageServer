// services/deviceService.ts
import { DeviceData, DeviceRegistration } from '../../../shared/src/deviceData';
import deviceRepository from '../repositories/deviceRepository';

class DeviceService {
    register = async (deviceData: DeviceData) => {
        const registrationTime = new Date();
        const registration: DeviceRegistration = { 
            registrationTime, 
            deviceData,
            lastSeen: registrationTime
        };
        
        await deviceRepository.saveDevice(registration);
        return { message: 'Device registered successfully' };
    };

    updateLastSeen = async (deviceData: DeviceData) => {
        // Get existing device registration
        const existingDevice = await deviceRepository.getDeviceById(deviceData.id);
        
        if (existingDevice) {
            // Update lastSeen timestamp and device data
            const updatedRegistration: DeviceRegistration = {
                registrationTime: existingDevice.registrationTime,
                lastSeen: new Date(),
                deviceData: deviceData
            };
            
            await deviceRepository.saveDevice(updatedRegistration);
            return { 
                message: 'Device ping successful',
                lastSeen: updatedRegistration.lastSeen
            };
        } else {
            // If device doesn't exist yet, register it
            const now = new Date();
            const newRegistration: DeviceRegistration = { 
                registrationTime: now, 
                deviceData,
                lastSeen: now
            };
            
            await deviceRepository.saveDevice(newRegistration);
            return { 
                message: 'New device registered via ping',
                lastSeen: newRegistration.lastSeen
            };
        }
    };

    getDevices = async () => {
        return await deviceRepository.getAllDevices();
    }

    getDeviceById = async (id: string) => {
        return await deviceRepository.getDeviceById(id);
    }
}

export default new DeviceService();