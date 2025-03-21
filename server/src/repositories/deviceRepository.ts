import { PutCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, DEVICE_PING_TABLE } from '../config/dynamoDb';
import { DeviceData, DeviceRegistration } from '../../../shared/src/deviceData';

class DeviceRepository {
  async saveDevice(registration: DeviceRegistration): Promise<void> {
    const command = new PutCommand({
      TableName: DEVICE_PING_TABLE,
      Item: {
        id: registration.deviceData.id,
        registrationTime: registration.registrationTime.toISOString(),
        lastSeen: registration.lastSeen.toISOString(),
        deviceData: registration.deviceData
      }
    });

    await docClient.send(command);
  }

  async getDeviceById(id: string): Promise<DeviceRegistration | null> {
    const command = new GetCommand({
      TableName: DEVICE_PING_TABLE,
      Key: { id }
    });

    const response = await docClient.send(command);
    if (!response.Item) return null;

    return this.mapToDeviceRegistration(response.Item);
  }

  async getAllDevices(): Promise<DeviceRegistration[]> {
    const command = new ScanCommand({
      TableName: DEVICE_PING_TABLE
    });

    const response = await docClient.send(command);
    const items = response.Items || [];
    
    return items.map(item => this.mapToDeviceRegistration(item));
  }

  private mapToDeviceRegistration(item: Record<string, any>): DeviceRegistration {
    return {
      registrationTime: new Date(item.registrationTime),
      lastSeen: item.lastSeen ? new Date(item.lastSeen) : new Date(item.registrationTime), // Fallback for backward compatibility
      deviceData: item.deviceData as DeviceData
    };
  }
}

export default new DeviceRepository();