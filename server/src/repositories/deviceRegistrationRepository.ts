import { v4 as uuidv4 } from 'uuid';
import { PutCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, DEVICE_REGISTRATION_TABLE } from '../config/dynamoDb';
import { DeviceRegistrationRequest, DeviceRegistrationResponse } from '../../../shared/src/deviceData';

export interface StoredDeviceRegistration extends DeviceRegistrationResponse {
  deviceType?: string;
  hardwareId?: string;
  active: boolean;
}

class DeviceRegistrationRepository {
  async registerDevice(request: DeviceRegistrationRequest): Promise<DeviceRegistrationResponse> {
    const id = uuidv4();
    const registrationTime = new Date();
    
    const registration: StoredDeviceRegistration = {
      id,
      registrationTime,
      deviceType: request.deviceType,
      hardwareId: request.hardwareId,
      active: true
    };
    
    const command = new PutCommand({
      TableName: DEVICE_REGISTRATION_TABLE,
      Item: {
        id,
        registrationTime: registrationTime.toISOString(),
        deviceType: request.deviceType,
        hardwareId: request.hardwareId,
        active: true
      }
    });
    
    await docClient.send(command);
    
    return {
      id,
      registrationTime
    };
  }
  
  async getDeviceById(id: string): Promise<StoredDeviceRegistration | null> {
    const command = new GetCommand({
      TableName: DEVICE_REGISTRATION_TABLE,
      Key: { id }
    });
    
    const response = await docClient.send(command);
    if (!response.Item) return null;
    
    return {
      id: response.Item.id,
      registrationTime: new Date(response.Item.registrationTime),
      deviceType: response.Item.deviceType,
      hardwareId: response.Item.hardwareId,
      active: response.Item.active
    };
  }
  
  async getAllDevices(): Promise<StoredDeviceRegistration[]> {
    const command = new ScanCommand({
      TableName: DEVICE_REGISTRATION_TABLE
    });
    
    const response = await docClient.send(command);
    const items = response.Items || [];
    
    return items.map(item => ({
      id: item.id,
      registrationTime: new Date(item.registrationTime),
      deviceType: item.deviceType,
      hardwareId: item.hardwareId,
      active: item.active
    }));
  }
  
  async deactivateDevice(id: string): Promise<void> {
    const command = new PutCommand({
      TableName: DEVICE_REGISTRATION_TABLE,
      Item: {
        id,
        active: false
      }
    });
    
    await docClient.send(command);
  }
}

export default new DeviceRegistrationRepository();