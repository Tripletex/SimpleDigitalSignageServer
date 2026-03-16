import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { tenantSecrets } from '../db/schema/index.ts';
import { uuidv7 } from '../utils/helpers.ts';
import { encrypt, decrypt } from '../utils/encryption.ts';

const tenantSecretRepository = {
  async getSecretsByTenant(tenantId: string) {
    const secrets = await db.query.tenantSecrets.findMany({
      where: eq(tenantSecrets.tenantId, tenantId),
      with: { createdBy: true },
    });

    // Return without decrypting values — list view only shows metadata
    return secrets.map((s) => ({
      id: s.id,
      name: s.name,
      domain: s.domain,
      description: s.description,
      createdById: s.createdById,
      createdByEmail: s.createdBy?.email,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  },

  async getSecretById(id: string, tenantId: string) {
    return db.query.tenantSecrets.findFirst({
      where: and(
        eq(tenantSecrets.id, id),
        eq(tenantSecrets.tenantId, tenantId),
      ),
    });
  },

  async getDecryptedValue(id: string, tenantId: string): Promise<string | null> {
    const secret = await this.getSecretById(id, tenantId);
    if (!secret) return null;
    return decrypt(secret.encryptedValue);
  },

  async createSecret(data: {
    tenantId: string;
    name: string;
    value: string;
    domain?: string;
    description?: string;
    createdById: string;
  }) {
    const encryptedValue = await encrypt(data.value);

    const [created] = await db.insert(tenantSecrets).values({
      id: uuidv7(),
      tenantId: data.tenantId,
      name: data.name,
      encryptedValue,
      domain: data.domain ?? null,
      description: data.description ?? null,
      createdById: data.createdById,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return {
      id: created.id,
      name: created.name,
      domain: created.domain,
      description: created.description,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  },

  async updateSecret(id: string, tenantId: string, data: {
    name?: string;
    value?: string;
    domain?: string | null;
    description?: string;
  }) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.domain !== undefined) updates.domain = data.domain;
    if (data.description !== undefined) updates.description = data.description;
    if (data.value !== undefined) updates.encryptedValue = await encrypt(data.value);

    const [updated] = await db.update(tenantSecrets)
      .set(updates)
      .where(and(
        eq(tenantSecrets.id, id),
        eq(tenantSecrets.tenantId, tenantId),
      ))
      .returning();

    if (!updated) return null;

    return {
      id: updated.id,
      name: updated.name,
      domain: updated.domain,
      description: updated.description,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  },

  async deleteSecret(id: string, tenantId: string) {
    const result = await db.delete(tenantSecrets)
      .where(and(
        eq(tenantSecrets.id, id),
        eq(tenantSecrets.tenantId, tenantId),
      ))
      .returning();
    return result.length > 0;
  },
};

export default tenantSecretRepository;
