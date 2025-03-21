// models/deviceData.ts
export interface Network {
    name: string;
    ipAddress: string[];
}

export interface DeviceData {
    id: string;
    name: string;
    networks: Network[];
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