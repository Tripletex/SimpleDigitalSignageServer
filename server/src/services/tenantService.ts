import tenantRepository from '../repositories/tenantRepository';
import userRepository from '../repositories/userRepository';
import userService from '../services/userService';
import emailVerificationService from '../services/emailVerificationService';
import { 
  Tenant, 
  TenantMember, 
  TenantRole, 
  TenantMemberStatus,
  TenantResponse,
  TenantDetailResponse,
  TenantMemberResponse
} from '../../../shared/src/tenantData';

class TenantService {
  // Tenant operations
  async createTenant(name: string, userId: string, isPersonal: boolean = false): Promise<TenantResponse> {
    const tenant = await tenantRepository.createTenant(name, userId, isPersonal);
    
    return {
      id: tenant.id,
      name: tenant.name,
      isPersonal: tenant.isPersonal,
      createdAt: tenant.createdAt.toISOString(),
      userRole: TenantRole.OWNER
    };
  }
  
  async getUserTenants(userId: string, skipPersonalTenantCreation: boolean = false): Promise<TenantResponse[]> {
    // Ensure the user exists
    const user = await userRepository.getUserById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    // Optionally create personal tenant if it doesn't exist
    if (!skipPersonalTenantCreation) {
      await tenantRepository.createPersonalTenantIfNeeded(userId, user.email, user.displayName);
    }
    
    // Get all tenants the user is a member of
    const memberships = await tenantRepository.getUserTenants(userId);
    console.log(`Found ${memberships.length} tenant memberships for user ${userId}`);
    
    // Map each membership to a tenant with role
    const tenants: TenantResponse[] = [];
    
    for (const membership of memberships) {
      const tenant = await tenantRepository.getTenantById(membership.tenantId);
      if (tenant) {
        // Get member count
        const members = await tenantRepository.getTenantMembers(tenant.id);
        
        tenants.push({
          id: tenant.id,
          name: tenant.name,
          isPersonal: tenant.isPersonal,
          createdAt: tenant.createdAt.toISOString(),
          userRole: membership.role,
          memberCount: members.length
        });
      }
    }
    
    return tenants;
  }
  
  async getTenantDetails(tenantId: string, userId: string): Promise<TenantDetailResponse | null> {
    // Check if the user is a member of this tenant
    const membership = await tenantRepository.getTenantMember(tenantId, userId);
    if (!membership) {
      throw new Error(`User ${userId} is not a member of tenant ${tenantId}`);
    }
    
    const tenant = await tenantRepository.getTenantById(tenantId);
    if (!tenant) {
      return null;
    }
    
    // Get all members
    const members = await tenantRepository.getTenantMembers(tenantId);
    
    const memberResponses: TenantMemberResponse[] = members.map(member => ({
      userId: member.userId,
      email: member.user?.email || '',
      displayName: member.user?.displayName || '',
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt.toISOString()
    }));
    
    return {
      id: tenant.id,
      name: tenant.name,
      isPersonal: tenant.isPersonal,
      createdAt: tenant.createdAt.toISOString(),
      userRole: membership.role,
      members: memberResponses
    };
  }
  
  async updateTenant(tenantId: string, userId: string, name: string): Promise<TenantResponse | null> {
    // Check if the user has permission to update the tenant
    const membership = await tenantRepository.getTenantMember(tenantId, userId);
    if (!membership) {
      throw new Error(`User ${userId} is not a member of tenant ${tenantId}`);
    }
    
    if (membership.role !== TenantRole.OWNER && membership.role !== TenantRole.ADMIN) {
      throw new Error(`User ${userId} does not have permission to update tenant ${tenantId}`);
    }
    
    const tenant = await tenantRepository.updateTenant(tenantId, name);
    if (!tenant) {
      return null;
    }
    
    return {
      id: tenant.id,
      name: tenant.name,
      isPersonal: tenant.isPersonal,
      createdAt: tenant.createdAt.toISOString(),
      userRole: membership.role
    };
  }
  
  async deleteTenant(tenantId: string, userId: string): Promise<void> {
    // Check if the user has permission to delete the tenant
    const membership = await tenantRepository.getTenantMember(tenantId, userId);
    if (!membership) {
      throw new Error(`User ${userId} is not a member of tenant ${tenantId}`);
    }
    
    if (membership.role !== TenantRole.OWNER) {
      throw new Error(`User ${userId} does not have permission to delete tenant ${tenantId}`);
    }
    
    // Don't allow deleting personal tenants
    const tenant = await tenantRepository.getTenantById(tenantId);
    if (!tenant) {
      throw new Error(`Tenant with ID ${tenantId} not found`);
    }
    
    if (tenant.isPersonal) {
      throw new Error(`Cannot delete personal tenant ${tenantId}`);
    }
    
    await tenantRepository.deleteTenant(tenantId);
  }
  
  // Member operations
  async inviteUserToTenant(tenantId: string, inviterUserId: string, email: string, role: TenantRole): Promise<string | null> {
    // Check if the inviter has permission to invite users
    const inviterMembership = await tenantRepository.getTenantMember(tenantId, inviterUserId);
    if (!inviterMembership) {
      throw new Error(`User ${inviterUserId} is not a member of tenant ${tenantId}`);
    }
    
    if (inviterMembership.role !== TenantRole.OWNER && inviterMembership.role !== TenantRole.ADMIN) {
      throw new Error(`User ${inviterUserId} does not have permission to invite users to tenant ${tenantId}`);
    }
    
    // Find the tenant information (for the invitation email)
    const tenant = await tenantRepository.getTenantById(tenantId);
    if (!tenant) {
      throw new Error(`Tenant with ID ${tenantId} not found`);
    }
    
    // Find the user by email
    const user = await userRepository.getUserByEmail(email);
    
    if (user) {
      // Check if the user is already a member
      const existingMembership = await tenantRepository.getTenantMember(tenantId, user.id);
      if (existingMembership) {
        throw new Error(`User ${email} is already a member of tenant ${tenantId}`);
      }
      
      // Add the user as a pending member
      await tenantRepository.addTenantMember(
        tenantId,
        user.id,
        role,
        TenantMemberStatus.PENDING,
        inviterUserId
      );
      
      // No need for a verification token for existing users
      console.log(`Invitation sent to existing user ${email} for tenant "${tenant.name}" with role ${role}`);
      return null;
    } else {
      // For users who haven't registered, create a verification token
      // Create a verification token with tenant invitation details
      const token = await emailVerificationService.createInvitationToken(email, tenantId, role);
      
      console.log(`Invitation token created for new user ${email} for tenant "${tenant.name}" with role ${role}`);
      return token;
    }
  }
  
  async updateMemberRole(tenantId: string, updaterUserId: string, targetUserId: string, newRole: TenantRole): Promise<void> {
    // Check if the updater has permission to update roles
    const updaterMembership = await tenantRepository.getTenantMember(tenantId, updaterUserId);
    if (!updaterMembership) {
      throw new Error(`User ${updaterUserId} is not a member of tenant ${tenantId}`);
    }
    
    if (updaterMembership.role !== TenantRole.OWNER) {
      throw new Error(`User ${updaterUserId} does not have permission to update roles in tenant ${tenantId}`);
    }
    
    // Check if the target user is a member
    const targetMembership = await tenantRepository.getTenantMember(tenantId, targetUserId);
    if (!targetMembership) {
      throw new Error(`User ${targetUserId} is not a member of tenant ${tenantId}`);
    }
    
    // Don't allow changing the owner's role
    const tenant = await tenantRepository.getTenantById(tenantId);
    if (!tenant) {
      throw new Error(`Tenant with ID ${tenantId} not found`);
    }
    
    if (targetUserId === tenant.ownerId) {
      throw new Error(`Cannot change the role of the tenant owner`);
    }
    
    await tenantRepository.updateTenantMemberRole(tenantId, targetUserId, newRole);
  }
  
  async removeMember(tenantId: string, removerUserId: string, targetUserId: string): Promise<void> {
    // Check if the remover has permission to remove members
    const removerMembership = await tenantRepository.getTenantMember(tenantId, removerUserId);
    if (!removerMembership) {
      throw new Error(`User ${removerUserId} is not a member of tenant ${tenantId}`);
    }
    
    if (removerMembership.role !== TenantRole.OWNER && removerMembership.role !== TenantRole.ADMIN) {
      throw new Error(`User ${removerUserId} does not have permission to remove members from tenant ${tenantId}`);
    }
    
    // Check if the target user is a member
    const targetMembership = await tenantRepository.getTenantMember(tenantId, targetUserId);
    if (!targetMembership) {
      throw new Error(`User ${targetUserId} is not a member of tenant ${tenantId}`);
    }
    
    // Don't allow removing the owner
    const tenant = await tenantRepository.getTenantById(tenantId);
    if (!tenant) {
      throw new Error(`Tenant with ID ${tenantId} not found`);
    }
    
    if (targetUserId === tenant.ownerId) {
      throw new Error(`Cannot remove the tenant owner`);
    }
    
    // Admin can't remove another admin
    if (removerMembership.role === TenantRole.ADMIN && targetMembership.role === TenantRole.ADMIN) {
      throw new Error(`Admin cannot remove another admin`);
    }
    
    await tenantRepository.removeTenantMember(tenantId, targetUserId);
  }
  
  // User can leave a tenant they are a member of
  async leaveTenant(tenantId: string, userId: string): Promise<void> {
    // Check if the user is a member
    const membership = await tenantRepository.getTenantMember(tenantId, userId);
    if (!membership) {
      throw new Error(`User ${userId} is not a member of tenant ${tenantId}`);
    }
    
    // Don't allow the owner to leave
    const tenant = await tenantRepository.getTenantById(tenantId);
    if (!tenant) {
      throw new Error(`Tenant with ID ${tenantId} not found`);
    }
    
    if (userId === tenant.ownerId) {
      throw new Error(`Owner cannot leave the tenant. Transfer ownership first.`);
    }
    
    // Don't allow leaving personal tenant
    if (tenant.isPersonal) {
      throw new Error(`Cannot leave personal tenant`);
    }
    
    await tenantRepository.removeTenantMember(tenantId, userId);
  }
  
  // Create the personal tenant for a user when they first log in
  async createPersonalTenantForUser(userId: string, email: string, displayName?: string): Promise<TenantResponse> {
    const tenant = await tenantRepository.createPersonalTenantIfNeeded(userId, email, displayName);
    
    return {
      id: tenant.id,
      name: tenant.name,
      isPersonal: tenant.isPersonal,
      createdAt: tenant.createdAt.toISOString(),
      userRole: TenantRole.OWNER
    };
  }
}

export default new TenantService();