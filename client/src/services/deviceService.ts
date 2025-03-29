// Client-side device service for interacting with device APIs

// Define shared types locally to avoid importing from outside src directory
export interface Network {
  name: string;
  ipAddress: string[];
}

export interface DeviceData {
  id: string;
  name: string;
  networks: Network[];
  tenantId?: string; // ID of the tenant that claimed this device
  claimedBy?: string; // ID of the user who claimed the device
  claimedAt?: Date; // When the device was claimed
  displayName?: string; // Custom name given to the device by the tenant
}

export interface DeviceRegistration {
  registrationTime: Date;
  lastSeen: Date;
  deviceData: DeviceData;
}

export interface DeviceRegistrationRequest {
  // Minimal information provided by device during registration
  deviceType?: string;
  hardwareId?: string; // Optional hardware identifier (MAC address, serial number, etc.)
}

export interface DeviceRegistrationResponse {
  id: string; // The UUID assigned to this device
  registrationTime: Date;
}

// Device claim request and response
export interface DeviceClaimRequest {
  deviceId: string;
  displayName?: string;
}

export interface DeviceClaimResponse {
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
export const getAllDevices = async (): Promise<DeviceRegistration[]> => {
  const response = await fetch('/api/device/list');
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
  
  const response = await fetch(`/api/device/tenant/${tenantId}/claim`, {
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
  const response = await fetch(`/api/device/tenant/${tenantId}/devices/${deviceId}`, {
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