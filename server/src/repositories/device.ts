import { eq, isNotNull } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { devices, deviceNetworks, deviceRegistrations } from '../db/schema/index.ts';
import { uuidv7 } from '../utils/helpers.ts';

const deviceRepository = {
  async updateLastSeen(deviceData: {
    id: string;
    name: string;
    networks: Array<{ name: string; ipAddresses: string[] }>;
  }) {
    return db.transaction(async (tx) => {
      // Find or create device
      let device = await tx.query.devices.findFirst({
        where: eq(devices.id, deviceData.id),
      });

      if (!device) {
        const [created] = await tx.insert(devices).values({
          id: deviceData.id,
          name: deviceData.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning();
        device = created;
      } else {
        const [updated] = await tx.update(devices)
          .set({ name: deviceData.name, updatedAt: new Date() })
          .where(eq(devices.id, deviceData.id))
          .returning();
        device = updated;
      }

      // Update registration lastSeen
      await tx.update(deviceRegistrations)
        .set({ lastSeen: new Date(), updatedAt: new Date() })
        .where(eq(deviceRegistrations.deviceId, device.id));

      // Sync networks: delete old, create new
      await tx.delete(deviceNetworks)
        .where(eq(deviceNetworks.deviceId, device.id));

      if (deviceData.networks.length > 0 && device.tenantId) {
        await tx.insert(deviceNetworks).values(
          deviceData.networks.map((n) => ({
            id: uuidv7(),
            deviceId: device.id,
            tenantId: device.tenantId!,
            name: n.name,
            ipAddresses: n.ipAddresses,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );
      }

      return device;
    });
  },

  async getDeviceById(id: string) {
    return db.query.devices.findFirst({
      where: eq(devices.id, id),
      with: {
        networks: true,
        registrations: true,
        tenant: true,
        claimedBy: true,
      },
    });
  },

  async getDevices() {
    return db.query.devices.findMany({
      with: {
        networks: true,
        registrations: true,
        tenant: true,
        claimedBy: true,
      },
    });
  },

  async getClaimedDevices() {
    return db.query.devices.findMany({
      where: isNotNull(devices.tenantId),
      with: {
        networks: true,
        registrations: true,
        tenant: true,
        claimedBy: true,
      },
    });
  },

  async getDevicesByTenant(tenantId: string) {
    return db.query.devices.findMany({
      where: eq(devices.tenantId, tenantId),
      with: {
        networks: true,
        registrations: true,
        tenant: true,
        claimedBy: true,
      },
    });
  },

  async claimDevice(
    deviceId: string,
    tenantId: string,
    userId: string,
    displayName?: string,
  ) {
    return db.transaction(async (tx) => {
      const [device] = await tx.update(devices)
        .set({
          tenantId,
          claimedById: userId,
          claimedAt: new Date(),
          displayName: displayName ?? null,
          updatedAt: new Date(),
        })
        .where(eq(devices.id, deviceId))
        .returning();

      await tx.update(deviceRegistrations)
        .set({ tenantId, updatedAt: new Date() })
        .where(eq(deviceRegistrations.deviceId, deviceId));

      await tx.update(deviceNetworks)
        .set({ tenantId, updatedAt: new Date() })
        .where(eq(deviceNetworks.deviceId, deviceId));

      return device;
    });
  },

  async releaseDevice(deviceId: string) {
    return db.transaction(async (tx) => {
      const [device] = await tx.update(devices)
        .set({
          tenantId: null,
          claimedById: null,
          claimedAt: null,
          displayName: null,
          campaignId: null,
          updatedAt: new Date(),
        })
        .where(eq(devices.id, deviceId))
        .returning();

      await tx.update(deviceRegistrations)
        .set({ tenantId: null, updatedAt: new Date() })
        .where(eq(deviceRegistrations.deviceId, deviceId));

      await tx.delete(deviceNetworks)
        .where(eq(deviceNetworks.deviceId, deviceId));

      return device;
    });
  },

  async assignCampaign(deviceId: string, campaignId: string | null) {
    const result = await db.update(devices)
      .set({ campaignId, updatedAt: new Date() })
      .where(eq(devices.id, deviceId))
      .returning();
    return result[0];
  },

  async saveDevice(id: string, data: Partial<{
    name: string;
    displayName: string;
    tenantId: string;
    campaignId: string;
  }>) {
    const result = await db.update(devices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(devices.id, id))
      .returning();
    return result[0];
  },
};

export default deviceRepository;
