import { eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { authenticators } from '../db/schema/index.ts';
import { uuidv7 } from '../utils/helpers.ts';

const authenticatorRepository = {
  async createAuthenticator(data: {
    userId: string;
    credentialId: string;
    publicKey: string;
    counter: string;
    deviceType: string;
    transports?: string;
    fmt?: string;
    name?: string;
  }) {
    const result = await db.insert(authenticators).values({
      id: uuidv7(),
      userId: data.userId,
      credentialId: data.credentialId,
      publicKey: data.publicKey,
      counter: data.counter,
      deviceType: data.deviceType,
      transports: data.transports,
      fmt: data.fmt,
      name: data.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  },

  async getAuthenticatorByCredentialId(credentialId: string) {
    return db.query.authenticators.findFirst({
      where: eq(authenticators.credentialId, credentialId),
      with: {
        user: true,
      },
    });
  },

  async getAuthenticatorsByUserId(userId: string) {
    return db.query.authenticators.findMany({
      where: eq(authenticators.userId, userId),
    });
  },

  async updateAuthenticatorCounter(id: string, counter: string) {
    const result = await db.update(authenticators)
      .set({ counter, updatedAt: new Date() })
      .where(eq(authenticators.id, id))
      .returning();
    return result[0];
  },

  async deleteAuthenticator(id: string) {
    return db.delete(authenticators).where(eq(authenticators.id, id));
  },
};

export default authenticatorRepository;
