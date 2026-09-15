import { eq, and, gt, sql } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { deviceAuthChallenges, deviceRegistrations } from '../db/schema/index.ts';
import { uuidv7 } from '../utils/helpers.ts';

const deviceAuthRepository = {
  async createChallenge(data: {
    deviceId: string;
    challenge?: string;
    expiresMinutes?: number;
  }) {
    const challenge = data.challenge ?? crypto.randomUUID();
    const expiresMinutes = data.expiresMinutes ?? 5;
    const expires = new Date(Date.now() + expiresMinutes * 60 * 1000);

    const result = await db.insert(deviceAuthChallenges).values({
      id: uuidv7(),
      deviceId: data.deviceId,
      challenge,
      expires,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  },

  async getChallenge(deviceId: string, challenge: string) {
    return db.query.deviceAuthChallenges.findFirst({
      where: and(
        eq(deviceAuthChallenges.deviceId, deviceId),
        eq(deviceAuthChallenges.challenge, challenge),
        eq(deviceAuthChallenges.used, false),
        gt(deviceAuthChallenges.expires, new Date()),
      ),
    });
  },

  async useChallenge(id: string) {
    const result = await db.update(deviceAuthChallenges)
      .set({ used: true, updatedAt: new Date() })
      .where(eq(deviceAuthChallenges.id, id))
      .returning();
    return result[0];
  },

  async getDevicePublicKey(deviceId: string) {
    const registration = await db.query.deviceRegistrations.findFirst({
      where: and(
        eq(deviceRegistrations.deviceId, deviceId),
        eq(deviceRegistrations.active, true),
      ),
    });
    return registration?.publicKey ?? null;
  },

  async cleanupExpiredChallenges() {
    return db.delete(deviceAuthChallenges)
      .where(sql`${deviceAuthChallenges.expires} < now()`);
  },
};

export default deviceAuthRepository;
