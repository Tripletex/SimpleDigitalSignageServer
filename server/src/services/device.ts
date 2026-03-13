import deviceRepository from '../repositories/device.ts';

const deviceService = {
  async updateLastSeen(deviceData: {
    id: string;
    name: string;
    networks: Array<{ name: string; ipAddresses: string[] }>;
  }) {
    return deviceRepository.updateLastSeen(deviceData);
  },

  async getDeviceById(id: string) {
    return deviceRepository.getDeviceById(id);
  },

  async getDevices() {
    return deviceRepository.getDevices();
  },

  async getClaimedDevices() {
    return deviceRepository.getClaimedDevices();
  },

  async getDevicesByTenant(tenantId: string) {
    return deviceRepository.getDevicesByTenant(tenantId);
  },

  async claimDevice(
    deviceId: string,
    tenantId: string,
    userId: string,
    displayName?: string,
  ) {
    return deviceRepository.claimDevice(deviceId, tenantId, userId, displayName);
  },

  async releaseDevice(deviceId: string) {
    return deviceRepository.releaseDevice(deviceId);
  },

  async assignCampaign(deviceId: string, campaignId: string) {
    return deviceRepository.assignCampaign(deviceId, campaignId);
  },
};

export default deviceService;
