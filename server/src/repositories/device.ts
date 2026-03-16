import { eq, and, isNotNull } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { devices, deviceNetworks, deviceRegistrations, deviceDisplayCampaigns } from '../db/schema/index.ts';
import { uuidv7 } from '../utils/helpers.ts';

const deviceRepository = {
  async updateLastSeen(deviceData: {
    id: string;
    name: string;
    networks: Array<{ name: string; ipAddresses: string[] }>;
    displays?: Array<{ name: string; connected: boolean; primary: boolean; resolution?: string }>;
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
        const connectedCount = deviceData.displays?.filter((d) => d.connected).length ?? 0;
        const [updated] = await tx.update(devices)
          .set({
            name: deviceData.name,
            displayCount: connectedCount,
            displays: deviceData.displays ?? null,
            updatedAt: new Date(),
          })
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
        displayCampaigns: true,
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
        displayCampaigns: true,
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
        displayCampaigns: true,
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
        displayCampaigns: true,
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
      // Clear all display campaign assignments
      await tx.delete(deviceDisplayCampaigns)
        .where(eq(deviceDisplayCampaigns.deviceId, deviceId));

      const [device] = await tx.update(devices)
        .set({
          tenantId: null,
          claimedById: null,
          claimedAt: null,
          displayName: null,
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

  async assignDisplayCampaign(
    deviceId: string,
    displayName: string,
    campaignId: string | null,
    tenantId: string,
    hardwareId?: string,
  ) {
    if (campaignId === null) {
      // Remove assignment for this display
      await db.delete(deviceDisplayCampaigns)
        .where(and(
          eq(deviceDisplayCampaigns.deviceId, deviceId),
          eq(deviceDisplayCampaigns.displayName, displayName),
        ));
      return null;
    }

    // Upsert: try update first, then insert
    const existing = await db.query.deviceDisplayCampaigns.findFirst({
      where: and(
        eq(deviceDisplayCampaigns.deviceId, deviceId),
        eq(deviceDisplayCampaigns.displayName, displayName),
      ),
    });

    if (existing) {
      const [updated] = await db.update(deviceDisplayCampaigns)
        .set({ campaignId, hardwareId: hardwareId ?? existing.hardwareId, updatedAt: new Date() })
        .where(eq(deviceDisplayCampaigns.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(deviceDisplayCampaigns)
      .values({
        id: uuidv7(),
        deviceId,
        displayName,
        hardwareId: hardwareId ?? null,
        campaignId,
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return created;
  },

  async getDisplayCampaigns(deviceId: string) {
    return db.query.deviceDisplayCampaigns.findMany({
      where: eq(deviceDisplayCampaigns.deviceId, deviceId),
      with: {
        campaign: true,
      },
    });
  },

  async clearDisplayCampaigns(deviceId: string) {
    const result = await db.delete(deviceDisplayCampaigns)
      .where(eq(deviceDisplayCampaigns.deviceId, deviceId))
      .returning();
    return result.length;
  },

  async saveDevice(id: string, data: Partial<{
    name: string;
    displayName: string;
    tenantId: string;
  }>) {
    const result = await db.update(devices)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(devices.id, id))
      .returning();
    return result[0];
  },
};

export default deviceRepository;
