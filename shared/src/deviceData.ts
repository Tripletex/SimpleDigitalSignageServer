// models/deviceData.ts
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