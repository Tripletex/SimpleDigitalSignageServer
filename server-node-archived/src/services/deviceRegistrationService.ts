import { DeviceRegistrationRequest, DeviceRegistrationResponse } from '../../../shared/src/deviceData';
import deviceRegistrationRepository from '../repositories/deviceRegistrationRepository';

class DeviceRegistrationService {
  /**
   * Registers a new device and returns a unique device ID
   */
  registerDevice = async (request: DeviceRegistrationRequest): Promise<DeviceRegistrationResponse> => {
    return await deviceRegistrationRepository.registerDevice(request);
  };

  /**
   * Gets all registered devices
   */
  getAllRegisteredDevices = async () => {
    return await deviceRegistrationRepository.getAllRegisteredDevices();
  };
  
  /**
   * Gets all registered devices (alias for getAllRegisteredDevices)
   */
  getAllDevices = async () => {
    return await deviceRegistrationRepository.getAllDevices();
  };

  /**
   * Checks if a device ID is valid (exists and is active)
   */
  isValidDeviceId = async (id: string): Promise<boolean> => {
    const device = await deviceRegistrationRepository.getDeviceById(id);
    return device !== null && device.active === true;
  };
  
  /**
   * Gets a device by ID
   */
  getDeviceById = async (id: string) => {
    return await deviceRegistrationRepository.getDeviceById(id);
  };

  /**
   * Deactivates a device
   */
  deactivateDevice = async (id: string): Promise<void> => {
    await deviceRegistrationRepository.deactivateDevice(id);
  };
}

export default new DeviceRegistrationService();