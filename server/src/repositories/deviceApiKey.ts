import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { deviceApiKeys, devices } from '../db/schema/index.ts';
import { uuidv7 } from '../utils/helpers.ts';

async function hashApiKey(apiKey: string): Promise<string> {
  const encoded = new TextEncoder().encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const deviceApiKeyRepository = {
  async generateApiKey(deviceId: string, tenantId?: string) {
    const rawKey = crypto.randomUUID() + crypto.randomUUID();
    const apiKeyHash = await hashApiKey(rawKey);

    const result = await db.insert(deviceApiKeys).values({
      id: uuidv7(),
      deviceId,
      tenantId,
      apiKeyHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return { id: result[0].id, plainKey: rawKey };
  },

  async findByApiKey(apiKey: string) {
    const apiKeyHash = await hashApiKey(apiKey);

    return db.query.deviceApiKeys.findFirst({
      where: eq(deviceApiKeys.apiKeyHash, apiKeyHash),
      with: {
        device: true,
      },
    });
  },

  async getApiKeysByDeviceId(deviceId: string) {
    return db.query.deviceApiKeys.findMany({
      where: eq(deviceApiKeys.deviceId, deviceId),
    });
  },

  async validateApiKey(apiKey: string) {
    const apiKeyHash = await hashApiKey(apiKey);

    const key = await db.query.deviceApiKeys.findFirst({
      where: and(
        eq(deviceApiKeys.apiKeyHash, apiKeyHash),
        eq(deviceApiKeys.active, true),
        sql`(${deviceApiKeys.expiresAt} IS NULL OR ${deviceApiKeys.expiresAt} > now())`,
      ),
    });

    if (!key) {
      return { valid: false };
    }

    await db.update(deviceApiKeys)
      .set({ lastUsed: new Date(), updatedAt: new Date() })
      .where(eq(deviceApiKeys.id, key.id));

    return {
      valid: true,
      deviceId: key.deviceId,
      tenantId: key.tenantId,
    };
  },

  async revokeApiKey(id: string) {
    const result = await db.update(deviceApiKeys)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(deviceApiKeys.id, id))
      .returning();
    return result[0];
  },

  async revokeAllApiKeysForDevice(deviceId: string) {
    return db.update(deviceApiKeys)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(deviceApiKeys.deviceId, deviceId));
  },
};

export default deviceApiKeyRepository;
