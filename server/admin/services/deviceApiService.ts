import { csrfFetch } from '../utils/csrfFetch';

// Device API service - New file to bypass TypeScript caching issues
// This file replaces deviceService.ts

// Type definitions
export type Network = {
  name: string;
  ipAddress: string[];
}

export type DisplayCampaign = {
  displayName: string;
  hardwareId?: string;
  campaignId: string;
}

export type DeviceData = {
  id: string;
  name: string;
  networks: Network[];
  tenantId?: string;
  claimedBy?: string;
  claimedAt?: Date;
  displayName?: string;
  displayCount?: number;
  displays?: Array<{ name: string; hardwareId?: string; connected: boolean; primary: boolean; resolution?: string }>;
  displayCampaigns?: DisplayCampaign[];
}

export type DeviceRegistration = {
  registrationTime: Date;
  lastSeen: Date;
  deviceData: DeviceData;
}

export type DeviceRegistrationRequest = {
  deviceType?: string;
  hardwareId?: string;
}

export type DeviceClaimRequest = {
  deviceId: string;
  displayName?: string;
}

export type DeviceClaimResponse = {
  success: boolean;
  message: string;
  device?: DeviceData;
}

export type CampaignAssignmentResponse = {
  success: boolean;
  message: string;
  device?: DeviceData;
}

/**
 * Parse dates in the device registration data
 */
const parseDates = (data: any): DeviceRegistration[] => {
  return data.map((item: any) => ({
    ...item,
    registrationTime: item.registrationTime ? new Date(item.registrationTime) : new Date(),
    lastSeen: item.lastSeen ? new Date(item.lastSeen) : new Date()
  }));
};

/**
 * Get all devices for the current user
 */
export const getAllDevices = async (onlyClaimed: boolean = true): Promise<DeviceRegistration[]> => {
  const response = await fetch(`/api/device/list?onlyClaimed=${onlyClaimed}`);
  if (!response.ok) {
    throw new Error(`Failed to get devices: ${response.status}`);
  }
  const data = await response.json();
  return parseDates(data);
};

/**
 * Get devices for a specific tenant
 */
export const getTenantDevices = async (tenantId: string): Promise<DeviceRegistration[]> => {
  const response = await fetch(`/api/device/tenant/${tenantId}/devices`);
  if (!response.ok) {
    throw new Error(`Failed to get tenant devices: ${response.status}`);
  }
  
  const data = await response.json();
  return parseDates(data.devices || []);
};

/**
 * Claim a device for a tenant
 */
export const claimDevice = async (
  tenantId: string,
  deviceId: string,
  displayName?: string
): Promise<DeviceClaimResponse> => {
  const claimRequest: DeviceClaimRequest = {
    deviceId,
    displayName
  };
  
  const response = await csrfFetch(`/api/device/tenant/${tenantId}/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(claimRequest),
  });
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Failed to claim device: ${response.status}`);
  }
  
  return data;
};

/**
 * Release a device from a tenant
 */
export const releaseDevice = async (
  tenantId: string,
  deviceId: string
): Promise<DeviceClaimResponse> => {
  const response = await csrfFetch(`/api/device/tenant/${tenantId}/devices/${deviceId}`, {
    method: 'DELETE',
  });
  
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Failed to release device: ${response.status}`);
  }
  
  return data;
};

/**
 * Get a specific device by ID
 */
export const getDeviceById = async (id: string): Promise<DeviceRegistration> => {
  const response = await fetch(`/api/device/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to get device: ${response.status}`);
  }
  const data = await response.json();
  // Parse date fields
  return {
    ...data,
    registrationTime: data.registrationTime ? new Date(data.registrationTime) : new Date(),
    lastSeen: data.lastSeen ? new Date(data.lastSeen) : new Date()
  };
};

/**
 * Assign a campaign to a specific display on a device
 */
export const assignDisplayCampaign = async (
  tenantId: string,
  deviceId: string,
  displayName: string,
  campaignId: string | null
): Promise<CampaignAssignmentResponse> => {
  const response = await csrfFetch(
    `/api/device/tenant/${tenantId}/devices/${deviceId}/displays/${encodeURIComponent(displayName)}/campaign`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ campaignId }),
    },
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Failed to assign campaign to display: ${response.status}`);
  }

  return data;
};

/**
 * Clear all display campaign assignments for a device
 */
export const clearDisplayCampaigns = async (
  tenantId: string,
  deviceId: string,
): Promise<CampaignAssignmentResponse> => {
  const response = await csrfFetch(
    `/api/device/tenant/${tenantId}/devices/${deviceId}/campaigns`,
    { method: 'DELETE' },
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `Failed to clear campaigns: ${response.status}`);
  }

  return data;
};