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
    deviceData: DeviceData
}