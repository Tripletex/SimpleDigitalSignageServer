import { Tenant } from '../models/Tenant';
import { TenantMember } from '../models/TenantMember';
import { PendingInvitation } from '../models/PendingInvitation';
import { User } from '../models/User';
import { generateUUID } from '../utils/helpers';
import { TenantRole, TenantMemberStatus } from '../../../shared/src/tenantData';
import { Op } from 'sequelize';

class TenantRepository {
  // Tenant operations
  async createTenant(
    name: string, 
    ownerId: string, 
    isPersonal: boolean = false
  ): Promise<Tenant> {
    // Create the tenant
    const tenant = await Tenant.create({
      id: generateUUID(),
      name,
      isPersonal,
      ownerId
    });
    
    // Add the owner as a member
    await TenantMember.create({
      id: generateUUID(),
      tenantId: tenant.id,
      userId: ownerId,
      role: TenantRole.OWNER,
      status: TenantMemberStatus.ACTIVE
    });
    
    return tenant;
  }
  
  async getTenantById(id: string): Promise<Tenant | null> {
    return await Tenant.findByPk(id, {
      include: [
        { 
          model: User, 
          as: 'owner'
        }
      ]
    });
  }
  
  async getTenantsByOwnerId(ownerId: string): Promise<Tenant[]> {
    return await Tenant.findAll({
      where: { ownerId },
      include: [
        { 
          model: User, 
          as: 'owner'
        }
      ]
    });
  }
  
  async updateTenant(id: string, name: string): Promise<Tenant | null> {
    const [updateCount] = await Tenant.update(
      { name },
      { where: { id } }
    );
    
    if (updateCount === 0) {
      return null;
    }
    
    return await this.getTenantById(id);
  }
  
  async deleteTenant(id: string): Promise<boolean> {
    // First delete all members
    await TenantMember.destroy({
      where: { tenantId: id }
    });
    
    // Then delete the tenant
    const deletedCount = await Tenant.destroy({
      where: { id }
    });
    
    return deletedCount > 0;
  }
  
  // Tenant membership operations
  async addTenantMember(
    tenantId: string, 
    userId: string, 
    role: TenantRole, 
    status: TenantMemberStatus = TenantMemberStatus.PENDING,
    invitedById?: string
  ): Promise<TenantMember> {
    const member = await TenantMember.create({
      id: generateUUID(),
      tenantId,
      userId,
      role,
      status,
      invitedById
    });
    
    return member;
  }
  
  async getTenantMembers(tenantId: string): Promise<TenantMember[]> {
    return await TenantMember.findAll({
      where: { tenantId },
      include: [
        {
          model: User,
          as: 'user'
        },
        {
          model: User,
          as: 'invitedBy'
        }
      ]
    });
  }
  
  async getUserTenants(userId: string): Promise<TenantMember[]> {
    console.log(`Finding tenant memberships for user: ${userId}`);
    
    // First check if the user exists
    const user = await User.findByPk(userId);
    if (!user) {
      console.warn(`User with ID ${userId} not found when getting tenant memberships`);
      return [];
    }
    
    const memberships = await TenantMember.findAll({
      where: { userId },
      include: [
        {
          model: Tenant,
          include: [
            {
              model: User,
              as: 'owner'
            }
          ]
        }
      ]
    });
    
    console.log(`Found ${memberships.length} tenant memberships for user ${userId}`);
    
    // Check if each membership has an associated tenant
    for (const membership of memberships) {
      if (!membership.tenant) {
        console.warn(`Membership ${membership.id} has no associated tenant`);
      } else {
        console.log(`Found tenant ${membership.tenant.id}: ${membership.tenant.name}`);
      }
    }
    
    return memberships;
  }
  
  async getTenantMember(tenantId: string, userId: string): Promise<TenantMember | null> {
    return await TenantMember.findOne({
      where: {
        tenantId,
        userId
      },
      include: [
        {
          model: User,
          as: 'user'
        }
      ]
    });
  }
  
  async updateTenantMemberRole(tenantId: string, userId: string, role: TenantRole): Promise<TenantMember | null> {
    const [updateCount] = await TenantMember.update(
      { role },
      { 
        where: { 
          tenantId,
          userId
        } 
      }
    );
    
    if (updateCount === 0) {
      return null;
    }
    
    return await this.getTenantMember(tenantId, userId);
  }
  
  async updateTenantMemberStatus(tenantId: string, userId: string, status: TenantMemberStatus): Promise<TenantMember | null> {
    const [updateCount] = await TenantMember.update(
      { status },
      { 
        where: { 
          tenantId,
          userId
        } 
      }
    );
    
    if (updateCount === 0) {
      return null;
    }
    
    return await this.getTenantMember(tenantId, userId);
  }
  
  async removeTenantMember(tenantId: string, userId: string): Promise<boolean> {
    const deletedCount = await TenantMember.destroy({
      where: {
        tenantId,
        userId
      }
    });
    
    return deletedCount > 0;
  }
  
  // Helper methods
  async createPersonalTenantIfNeeded(userId: string, userEmail: string, userDisplayName?: string): Promise<Tenant> {
    console.log(`Checking if user ${userId} has a personal tenant...`);
    
    // Check if the user already has a personal tenant
    const userMemberships = await TenantMember.findAll({
      where: { userId },
      include: [
        {
          model: Tenant,
          where: { isPersonal: true }
        }
      ]
    });
    
    console.log(`Found ${userMemberships.length} personal tenant memberships`);
    
    if (userMemberships.length > 0 && userMemberships[0].tenant) {
      console.log(`User already has personal tenant: ${userMemberships[0].tenant.id}`);
      return userMemberships[0].tenant;
    }
    
    console.log(`Creating personal tenant for user ${userId}`);
    
    // User doesn't have a personal tenant, create one
    const personalTenantName = `${userDisplayName || userEmail}'s Workspace`;
    const tenant = await this.createTenant(personalTenantName, userId, true);
    
    // Double-check that the member was created
    const membership = await TenantMember.findOne({
      where: { 
        tenantId: tenant.id,
        userId: userId
      }
    });
    
    if (!membership) {
      console.log(`Membership wasn't created automatically, creating it manually`);
      // Create the membership manually if it wasn't created
      await TenantMember.create({
        id: generateUUID(),
        tenantId: tenant.id,
        userId: userId,
        role: TenantRole.OWNER,
        status: TenantMemberStatus.ACTIVE
      });
    }
    
    console.log(`Personal tenant created: ${tenant.id}`);
    return tenant;
  }
  
  // Pending invitations
  async createPendingInvitation(
    tenantId: string,
    email: string,
    role: TenantRole,
    invitedById?: string
  ): Promise<PendingInvitation> {
    console.log(`Creating pending invitation for email ${email} to tenant ${tenantId} with role ${role}`);
    
    // Check for existing pending invitation
    const existingInvitation = await PendingInvitation.findOne({
      where: {
        tenantId,
        email,
        expiresAt: {
          [Op.gt]: new Date() // not expired yet
        }
      }
    });
    
    if (existingInvitation) {
      console.log(`Updating existing invitation for ${email} to role ${role}`);
      existingInvitation.role = role;
      
      // Reset expiration date to 14 days from now
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 14);
      existingInvitation.expiresAt = expiryDate;
      
      await existingInvitation.save();
      return existingInvitation;
    }
    
    // Create new invitation
    const invitation = await PendingInvitation.create({
      id: generateUUID(),
      tenantId,
      email,
      role,
      invitedById
    });
    
    console.log(`Created pending invitation: ${invitation.id}, expires on ${invitation.expiresAt}`);
    return invitation;
  }
  
  async getPendingInvitationsByEmail(email: string): Promise<PendingInvitation[]> {
    return await PendingInvitation.findAll({
      where: {
        email,
        expiresAt: {
          [Op.gt]: new Date() // not expired yet
        }
      },
      include: [
        {
          model: Tenant
        },
        {
          model: User,
          as: 'invitedBy'
        }
      ]
    });
  }
  
  async deletePendingInvitation(invitationId: string): Promise<boolean> {
    const deletedCount = await PendingInvitation.destroy({
      where: { id: invitationId }
    });
    
    return deletedCount > 0;
  }
  
  async cleanExpiredInvitations(): Promise<number> {
    const now = new Date();
    const deletedCount = await PendingInvitation.destroy({
      where: {
        expiresAt: {
          [Op.lt]: now
        }
      }
    });
    
    console.log(`Cleaned up ${deletedCount} expired invitations`);
    return deletedCount;
  }
  
  /**
   * Activate all pending memberships for a user
   * This should be called when a user logs in to accept pending invitations
   */
  async activatePendingMemberships(userId: string): Promise<number> {
    console.log(`Activating pending memberships for user ${userId}`);
    
    // Find all pending memberships for this user
    const pendingMemberships = await TenantMember.findAll({
      where: {
        userId,
        status: TenantMemberStatus.PENDING
      }
    });
    
    console.log(`Found ${pendingMemberships.length} pending memberships for user ${userId}`);
    
    // Update each membership to active
    let updatedCount = 0;
    for (const membership of pendingMemberships) {
      try {
        membership.status = TenantMemberStatus.ACTIVE;
        await membership.save();
        updatedCount++;
        console.log(`Activated membership ${membership.id} in tenant ${membership.tenantId}`);
      } catch (error) {
        console.error(`Error activating membership ${membership.id}:`, error);
      }
    }
    
    return updatedCount;
  }
}

export default new TenantRepository();