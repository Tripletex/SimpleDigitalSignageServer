import tenantRepository from '../repositories/tenant.ts';
import { cacheManager } from '../middleware/tenantAuthorization.ts';

const tenantService = {
  async createTenant(data: {
    name: string;
    userId: string;
    isPersonal?: boolean;
  }) {
    return tenantRepository.createTenant(data);
  },

  async getTenantById(id: string) {
    return tenantRepository.getTenantById(id);
  },

  async getUserTenants(userId: string) {
    return tenantRepository.getUserTenants(userId);
  },

  async updateTenant(id: string, data: { name: string }) {
    return tenantRepository.updateTenant(id, data);
  },

  async deleteTenant(id: string) {
    return tenantRepository.deleteTenant(id);
  },

  async addTenantMember(data: {
    tenantId: string;
    userId: string;
    role: 'owner' | 'admin' | 'member';
    status?: 'active' | 'pending';
    invitedById?: string;
  }) {
    const result = await tenantRepository.addTenantMember(data);
    cacheManager.clearTenant(data.tenantId);
    return result;
  },

  async getTenantMembers(tenantId: string) {
    return tenantRepository.getTenantMembers(tenantId);
  },

  async getTenantMember(tenantId: string, userId: string) {
    return tenantRepository.getTenantMember(tenantId, userId);
  },

  async updateTenantMemberRole(
    tenantId: string,
    userId: string,
    role: 'owner' | 'admin' | 'member',
  ) {
    const result = await tenantRepository.updateTenantMemberRole(tenantId, userId, role);
    cacheManager.clearTenant(tenantId);
    return result;
  },

  async removeTenantMember(tenantId: string, userId: string) {
    const result = await tenantRepository.removeTenantMember(tenantId, userId);
    cacheManager.clearTenant(tenantId);
    return result;
  },

  /**
   * Invite a user to a tenant by email.
   * Checks if the user is already a member, creates an invitation,
   * and creates a pending membership.
   */
  async inviteUserToTenant(
    tenantId: string,
    email: string,
    role: 'owner' | 'admin' | 'member',
    invitedById: string,
  ) {
    // Check if user is already a member
    const members = await tenantRepository.getTenantMembers(tenantId);
    const existingMember = members.find(
      (m) => m.user && 'email' in m.user && m.user.email === email,
    );

    if (existingMember) {
      throw new Error('User is already a member of this tenant');
    }

    // Create pending invitation
    const invitation = await tenantRepository.createPendingInvitation({
      tenantId,
      email,
      role,
      invitedById,
    });

    return invitation;
  },

  /**
   * Leave a tenant. Owners cannot leave their own tenant.
   */
  async leaveTenant(tenantId: string, userId: string) {
    const member = await tenantRepository.getTenantMember(tenantId, userId);

    if (!member) {
      throw new Error('User is not a member of this tenant');
    }

    if (member.role === 'owner') {
      throw new Error('Owner cannot leave their own tenant. Transfer ownership first.');
    }

    const result = await tenantRepository.removeTenantMember(tenantId, userId);
    cacheManager.clearTenant(tenantId);
    cacheManager.clearUser(userId);
    return result;
  },

  async createPersonalTenantIfNeeded(userId: string, email: string) {
    return tenantRepository.createPersonalTenantIfNeeded(userId, email);
  },
};

export default tenantService;
