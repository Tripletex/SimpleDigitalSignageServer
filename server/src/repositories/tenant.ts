import { eq, and, gt, sql } from 'drizzle-orm';
import { db } from '../db/client.ts';
import {
  tenants,
  tenantMembers,
  pendingInvitations,
} from '../db/schema/index.ts';
import { uuidv7 } from '../utils/helpers.ts';

const tenantRepository = {
  async createTenant(data: {
    name: string;
    userId: string;
    isPersonal?: boolean;
  }) {
    return db.transaction(async (tx) => {
      const [tenant] = await tx.insert(tenants).values({
        id: uuidv7(),
        name: data.name,
        isPersonal: data.isPersonal ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      await tx.insert(tenantMembers).values({
        id: uuidv7(),
        tenantId: tenant.id,
        userId: data.userId,
        role: 'owner',
        status: 'active',
        joinedAt: new Date(),
        updatedAt: new Date(),
      });

      return tenant;
    });
  },

  async getTenantById(id: string) {
    return db.query.tenants.findFirst({
      where: eq(tenants.id, id),
    });
  },

  async updateTenant(id: string, data: { name: string }) {
    const result = await db.update(tenants)
      .set({ name: data.name, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return result[0];
  },

  async deleteTenant(id: string) {
    return db.transaction(async (tx) => {
      await tx.delete(tenantMembers)
        .where(eq(tenantMembers.tenantId, id));
      await tx.delete(tenants)
        .where(eq(tenants.id, id));
    });
  },

  async addTenantMember(data: {
    tenantId: string;
    userId: string;
    role: 'owner' | 'admin' | 'member';
    status?: 'active' | 'pending';
    invitedById?: string;
  }) {
    const result = await db.insert(tenantMembers).values({
      id: uuidv7(),
      tenantId: data.tenantId,
      userId: data.userId,
      role: data.role,
      status: data.status ?? 'pending',
      invitedById: data.invitedById,
      joinedAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  },

  async getTenantMembers(tenantId: string) {
    return db.query.tenantMembers.findMany({
      where: eq(tenantMembers.tenantId, tenantId),
      with: {
        user: true,
      },
    });
  },

  async getUserTenants(userId: string) {
    return db.query.tenantMembers.findMany({
      where: eq(tenantMembers.userId, userId),
      with: {
        tenant: true,
      },
    });
  },

  async getTenantMember(tenantId: string, userId: string) {
    return db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.userId, userId),
      ),
    });
  },

  async updateTenantMemberRole(
    tenantId: string,
    userId: string,
    role: 'owner' | 'admin' | 'member',
  ) {
    const result = await db.update(tenantMembers)
      .set({ role, updatedAt: new Date() })
      .where(
        and(
          eq(tenantMembers.tenantId, tenantId),
          eq(tenantMembers.userId, userId),
        ),
      )
      .returning();
    return result[0];
  },

  async updateTenantMemberStatus(
    tenantId: string,
    userId: string,
    status: 'active' | 'pending',
  ) {
    const result = await db.update(tenantMembers)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(tenantMembers.tenantId, tenantId),
          eq(tenantMembers.userId, userId),
        ),
      )
      .returning();
    return result[0];
  },

  async removeTenantMember(tenantId: string, userId: string) {
    return db.delete(tenantMembers)
      .where(
        and(
          eq(tenantMembers.tenantId, tenantId),
          eq(tenantMembers.userId, userId),
        ),
      );
  },

  async createPersonalTenantIfNeeded(userId: string, email: string) {
    // Find personal tenant where user is an owner member
    const ownerMembership = await db.query.tenantMembers.findFirst({
      where: and(
        eq(tenantMembers.userId, userId),
        eq(tenantMembers.role, 'owner'),
      ),
      with: {
        tenant: true,
      },
    });

    if (ownerMembership?.tenant?.isPersonal) {
      return ownerMembership.tenant;
    }

    return tenantRepository.createTenant({
      name: `${email}'s Workspace`,
      userId,
      isPersonal: true,
    });
  },

  async createPendingInvitation(data: {
    tenantId: string;
    email: string;
    role: 'owner' | 'admin' | 'member';
    invitedById: string;
  }) {
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    // Upsert: delete existing invitation for same tenant+email, then insert
    await db.delete(pendingInvitations)
      .where(
        and(
          eq(pendingInvitations.tenantId, data.tenantId),
          eq(pendingInvitations.email, data.email),
        ),
      );

    const result = await db.insert(pendingInvitations).values({
      id: uuidv7(),
      tenantId: data.tenantId,
      email: data.email,
      role: data.role,
      invitedById: data.invitedById,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  },

  async getPendingInvitationsByTenant(tenantId: string) {
    return db.query.pendingInvitations.findMany({
      where: and(
        eq(pendingInvitations.tenantId, tenantId),
        gt(pendingInvitations.expiresAt, new Date()),
      ),
    });
  },

  async getPendingInvitationsByEmail(email: string) {
    return db.query.pendingInvitations.findMany({
      where: and(
        eq(pendingInvitations.email, email),
        gt(pendingInvitations.expiresAt, new Date()),
      ),
      with: {
        tenant: true,
      },
    });
  },

  async deletePendingInvitation(id: string) {
    return db.delete(pendingInvitations)
      .where(eq(pendingInvitations.id, id));
  },

  async cleanExpiredInvitations() {
    const result = await db.delete(pendingInvitations)
      .where(sql`${pendingInvitations.expiresAt} < now()`)
      .returning();
    return result.length;
  },

  async activatePendingMemberships(userId: string) {
    return db.update(tenantMembers)
      .set({ status: 'active', updatedAt: new Date() })
      .where(
        and(
          eq(tenantMembers.userId, userId),
          eq(tenantMembers.status, 'pending'),
        ),
      )
      .returning();
  },
};

export default tenantRepository;
