import { eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { devices, deviceRegistrations } from '../db/schema/index.ts';
import { uuidv7 } from '../utils/helpers.ts';

const deviceRegistrationRepository = {
  async registerDevice(data: {
    deviceType?: string;
    hardwareId?: string;
    publicKey: string;
  }) {
    return db.transaction(async (tx) => {
      const deviceName = data.deviceType || 'Unknown';

      const [device] = await tx.insert(devices).values({
        id: uuidv7(),
        name: deviceName,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      const [registration] = await tx.insert(deviceRegistrations).values({
        id: uuidv7(),
        deviceId: device.id,
        deviceType: data.deviceType,
        hardwareId: data.hardwareId,
        publicKey: data.publicKey,
        registrationTime: new Date(),
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      return { device, registration };
    });
  },

  async isValidDeviceId(deviceId: string) {
    const device = await db.query.devices.findFirst({
      where: eq(devices.id, deviceId),
    });
    return !!device;
  },

  async getAllRegisteredDevices() {
    return db.query.deviceRegistrations.findMany({
      with: {
        device: {
          with: {
            networks: true,
          },
        },
      },
    });
  },

  async getDeviceRegistration(deviceId: string) {
    return db.query.deviceRegistrations.findFirst({
      where: eq(deviceRegistrations.deviceId, deviceId),
      with: {
        device: true,
      },
    });
  },

  async deactivateDevice(deviceId: string) {
    const result = await db.update(deviceRegistrations)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(deviceRegistrations.deviceId, deviceId))
      .returning();
    return result[0];
  },
};

export default deviceRegistrationRepository;
