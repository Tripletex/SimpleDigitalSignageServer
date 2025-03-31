// Bridge file to redirect imports to the new file
// This approach bypasses any TypeScript caching issues

export type {
  DeviceData,
  DeviceRegistration,
  DeviceRegistrationRequest,
  DeviceClaimRequest,
  DeviceClaimResponse,
  Network,
  CampaignAssignmentResponse
} from './deviceApiService';

export {
  getAllDevices,
  getTenantDevices,
  claimDevice,
  releaseDevice,
  getDeviceById,
  assignCampaign
} from './deviceApiService';