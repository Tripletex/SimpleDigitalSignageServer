import { eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { users, authenticators } from '../db/schema/index.ts';
import { uuidv7 } from '../utils/helpers.ts';

const userRepository = {
  async createUser(data: {
    email: string;
    displayName?: string;
    role?: 'admin' | 'user';
  }) {
    const result = await db.insert(users).values({
      id: uuidv7(),
      email: data.email,
      displayName: data.displayName,
      role: data.role ?? 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  },

  async getUserById(id: string) {
    return db.query.users.findFirst({
      where: eq(users.id, id),
      with: {
        authenticators: true,
      },
    });
  },

  async getUserByEmail(email: string) {
    return db.query.users.findFirst({
      where: eq(users.email, email),
      with: {
        authenticators: true,
      },
    });
  },

  async getAllUsers() {
    return db.query.users.findMany({
      with: {
        authenticators: true,
      },
    });
  },

  async updateUser(id: string, data: Partial<{
    email: string;
    displayName: string;
    role: 'admin' | 'user';
  }>) {
    const result = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  },

  async deleteUser(id: string) {
    return db.transaction(async (tx) => {
      await tx.delete(authenticators)
        .where(eq(authenticators.userId, id));
      await tx.delete(users)
        .where(eq(users.id, id));
    });
  },

  async addAuthenticator(data: {
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
    });
  },

  async updateAuthenticatorCounter(credentialId: string, counter: string) {
    const result = await db.update(authenticators)
      .set({ counter, updatedAt: new Date() })
      .where(eq(authenticators.credentialId, credentialId))
      .returning();
    return result[0];
  },
};

export default userRepository;
