import deviceRegistrationRepository from '../repositories/deviceRegistration.ts';

const deviceRegistrationService = {
  async registerDevice(data: {
    publicKey: string;
    deviceType?: string;
    hardwareId?: string;
  }) {
    return deviceRegistrationRepository.registerDevice(data);
  },

  async isValidDeviceId(deviceId: string) {
    return deviceRegistrationRepository.isValidDeviceId(deviceId);
  },

  async getAllRegisteredDevices() {
    return deviceRegistrationRepository.getAllRegisteredDevices();
  },

  async getDeviceRegistration(deviceId: string) {
    return deviceRegistrationRepository.getDeviceRegistration(deviceId);
  },

  async deactivateDevice(deviceId: string) {
    return deviceRegistrationRepository.deactivateDevice(deviceId);
  },
};

export default deviceRegistrationService;
