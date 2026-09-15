// models/deviceData.ts
export interface Network {
    name: string;
    ipAddress: string[];
}

export interface DeviceData {
    id: string;
    name: string;
    networks: Network[];
    signature?: string; // Base64-encoded signature of the device data using the private key
    timestamp?: number; // Timestamp when the data was signed (in milliseconds since epoch)
    tenantId?: string; // ID of the tenant that claimed this device
    claimedBy?: string; // ID of the user who claimed the device
    claimedAt?: Date; // When the device was claimed
    displayName?: string; // Custom name given to the device by the tenant
    campaignId?: string; // ID of the campaign (playlist group) assigned to this device
}

export interface DeviceRegistration {
    registrationTime: Date;
    lastSeen: Date;
    deviceData: DeviceData;
}

export interface DeviceRegistrationRequest {
    // Information provided by device during registration
    deviceType?: string;
    hardwareId?: string; // Optional hardware identifier (MAC address, serial number, etc.)
    publicKey: string; // Base64-encoded public key for device authentication
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

// Device campaign assignment request and response
export interface DeviceCampaignAssignmentRequest {
    deviceId: string;
    campaignId: string | null; // null to remove assignment
}

export interface DeviceCampaignAssignmentResponse {
    success: boolean;
    message: string;
    device?: DeviceData;
}

// New interfaces for device authentication

// Request to start authentication (device provides ID)
export interface DeviceAuthenticationRequest {
    deviceId: string;
}

// Response with challenge token to sign
export interface DeviceAuthenticationChallenge {
    challenge: string; // Random challenge string that device must sign
    deviceId: string;
    expires: number; // Timestamp when challenge expires (in milliseconds)
}

// Request to complete authentication (device signs challenge)
export interface DeviceAuthenticationVerification {
    deviceId: string;
    challenge: string; // Original challenge string
    signature: string; // Signature of the challenge using the device's private key
}

// Successful authentication response
export interface DeviceAuthenticationResponse {
    success: boolean;
    message: string;
    apiKey?: string; // API key for future authenticated requests
    token?: string; // Deprecated: JWT token (kept for backward compatibility)
    expires?: number; // Deprecated: Token expiration (kept for backward compatibility)
}