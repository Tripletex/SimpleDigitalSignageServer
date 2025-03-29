import { Request, Response } from 'express';
import { handleErrors } from "../helpers/errorHandler";
import { validateAndConvert } from '../validators/validate';
import { 
  tenantCreateSchema, 
  tenantUpdateSchema, 
  tenantInviteSchema,
  tenantMemberUpdateSchema
} from '../validators/tenantValidator';
import { 
  TenantCreateRequest, 
  TenantInviteRequest, 
  TenantRole,
  TenantMemberStatus
} from '../../../shared/src/tenantData';
import tenantService from '../services/tenantService';
import userService from '../services/userService';
import { Tenant } from '../models/Tenant';
import { TenantMember } from '../models/TenantMember';
import { generateUUID } from '../utils/helpers';

class TenantController {
  /**
   * Get all tenants for the current user
   */
  public getUserTenants = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    console.log(`Fetching tenants for user ${req.user.id}`);
    
    // First ensure the user has a personal tenant
    const user = await userService.getUserById(req.user.id);
    if (!user) {
      console.error(`User ${req.user.id} not found in database`);
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    
    console.log(`Found user: ${user.id}, ${user.email}, attempting to create/get personal tenant`);
    
    // Explicitly create personal tenant if needed
    try {
      const personalTenant = await tenantService.createPersonalTenantForUser(
        user.id,
        user.email,
        user.displayName
      );
      console.log(`Ensured personal tenant exists for user ${req.user.id}:`, personalTenant);
    } catch (error) {
      console.error('Error creating personal tenant:', error);
      // Continue even if personal tenant creation fails
    }
    
    // Now get all tenants including the personal one
    // Skip additional personal tenant creation since we just did it
    const tenants = await tenantService.getUserTenants(req.user.id, true);
    console.log(`Found ${tenants.length} tenants for user ${req.user.id}:`, tenants);
    
    if (tenants.length === 0) {
      console.warn(`No tenants found for user ${req.user.id} even after personal tenant creation`);
    }
    
    res.json({
      success: true,
      tenants
    });
  });
  
  /**
   * Get details of a specific tenant
   */
  public getTenantDetails = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { id } = req.params;
    console.log(`Getting tenant details for tenant ${id} (user: ${req.user.id})`);
    
    try {
      const tenant = await tenantService.getTenantDetails(id, req.user.id);
      
      if (!tenant) {
        console.warn(`Tenant ${id} not found or user ${req.user.id} doesn't have access`);
        res.status(404).json({ success: false, message: 'Tenant not found' });
        return;
      }
      
      res.json({
        success: true,
        tenant
      });
    } catch (error) {
      console.error(`Error getting tenant details for ${id}:`, error);
      if ((error as Error).message.includes('not a member')) {
        res.status(403).json({ 
          success: false, 
          message: 'You do not have access to this tenant' 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: `Error retrieving tenant: ${(error as Error).message}` 
        });
      }
      return;
    }
  });
  
  /**
   * Create a new tenant
   */
  public createTenant = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const tenantRequest = await validateAndConvert<TenantCreateRequest>(req, tenantCreateSchema);
    
    const tenant = await tenantService.createTenant(
      tenantRequest.name,
      req.user.id,
      tenantRequest.isPersonal || false
    );
    
    res.status(201).json({
      success: true,
      tenant
    });
  });
  
  /**
   * Update a tenant
   */
  public updateTenant = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { id } = req.params;
    const { name } = await validateAndConvert<{ name: string }>(req, tenantUpdateSchema);
    
    try {
      const tenant = await tenantService.updateTenant(id, req.user.id, name);
      
      if (!tenant) {
        res.status(404).json({ success: false, message: 'Tenant not found' });
        return;
      }
      
      res.json({
        success: true,
        tenant
      });
    } catch (error) {
      res.status(403).json({ success: false, message: (error as Error).message });
      return;
    }
  });
  
  /**
   * Delete a tenant
   */
  public deleteTenant = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { id } = req.params;
    
    try {
      await tenantService.deleteTenant(id, req.user.id);
      
      res.json({
        success: true,
        message: 'Tenant deleted successfully'
      });
    } catch (error) {
      res.status(403).json({ success: false, message: (error as Error).message });
      return;
    }
  });
  
  /**
   * Invite a user to a tenant
   */
  public inviteUser = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { id } = req.params;
    const inviteRequest = await validateAndConvert<TenantInviteRequest>(req, tenantInviteSchema);
    
    try {
      // Get tenant info for the response
      const tenant = await Tenant.findByPk(id);
      if (!tenant) {
        res.status(404).json({ success: false, message: 'Tenant not found' });
        return;
      }
      
      // Invite the user
      const token = await tenantService.inviteUserToTenant(
        id,
        req.user.id,
        inviteRequest.email,
        inviteRequest.role
      );
      
      // If token is null, the user already exists and was added as a pending member
      if (!token) {
        res.json({
          success: true,
          message: `Invitation sent to existing user ${inviteRequest.email}`
        });
        return;
      }
      
      // Build the verification link
      const verificationLink = `${process.env.BASE_URL || 'http://localhost:3000'}/verify-email/${token}`;
      
      // In production, send an email with the verification link
      if (process.env.NODE_ENV === 'production') {
        // TODO: Implement email sending in production
        console.log(`[PRODUCTION] Would send invitation email to ${inviteRequest.email} with link: ${verificationLink}`);
        
        res.json({
          success: true,
          message: `Invitation sent to ${inviteRequest.email}`
        });
      } else {
        // In development, log the link and return it in the response for easy testing
        console.log(`\n===== DEVELOPMENT MODE =====`);
        console.log(`Invitation link for ${inviteRequest.email} to join "${tenant.name}":`);
        console.log(`${verificationLink}`);
        console.log(`=============================\n`);
        
        // For development, return the verification link in the response
        res.json({
          success: true,
          message: `Invitation sent to ${inviteRequest.email} (see console log for details)`,
          // Development-only fields
          dev: {
            note: "These fields are only included in development mode",
            verificationLink,
            token,
            directApiVerify: `/api/auth/verify-email/${token}`
          }
        });
      }
    } catch (error) {
      res.status(403).json({ success: false, message: (error as Error).message });
      return;
    }
  });
  
  /**
   * Update a member's role
   */
  public updateMemberRole = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { id, userId } = req.params;
    const { role } = await validateAndConvert<{ role: TenantRole }>(req, tenantMemberUpdateSchema);
    
    try {
      await tenantService.updateMemberRole(id, req.user.id, userId, role);
      
      res.json({
        success: true,
        message: `Member role updated successfully`
      });
    } catch (error) {
      res.status(403).json({ success: false, message: (error as Error).message });
      return;
    }
  });
  
  /**
   * Remove a member from a tenant
   */
  public removeMember = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { id, userId } = req.params;
    
    try {
      await tenantService.removeMember(id, req.user.id, userId);
      
      res.json({
        success: true,
        message: `Member removed successfully`
      });
    } catch (error) {
      res.status(403).json({ success: false, message: (error as Error).message });
      return;
    }
  });
  
  /**
   * Leave a tenant
   */
  public leaveTenant = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { id } = req.params;
    
    try {
      await tenantService.leaveTenant(id, req.user.id);
      
      res.json({
        success: true,
        message: `Left tenant successfully`
      });
    } catch (error) {
      res.status(403).json({ success: false, message: (error as Error).message });
      return;
    }
  });
  
  /**
   * Accept all pending tenant invitations for the current user
   */
  public acceptPendingInvitations = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    try {
      // Activate all pending memberships
      const updatedCount = await TenantMember.update(
        { status: TenantMemberStatus.ACTIVE },
        { 
          where: { 
            userId: req.user.id,
            status: TenantMemberStatus.PENDING
          } 
        }
      );
      
      console.log(`Accepted ${updatedCount[0]} pending invitations for user ${req.user.id}`);
      
      res.json({
        success: true,
        message: `Accepted ${updatedCount[0]} pending invitations`,
        updatedCount: updatedCount[0]
      });
    } catch (error) {
      console.error('Error accepting pending invitations:', error);
      res.status(500).json({ 
        success: false, 
        message: `Error accepting pending invitations: ${(error as Error).message}` 
      });
    }
  });
  
  /**
   * Force create a personal tenant (for debugging)
   */
  public forceCreatePersonalTenant = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    try {
      const userId = req.user.id;
      
      console.log(`=== FORCE CREATE PERSONAL TENANT FOR USER ${userId} ===`);
      
      // Get the user
      const user = await userService.getUserById(userId);
      if (!user) {
        console.error(`User ${userId} not found in database`);
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
      
      console.log(`Found user: ${JSON.stringify({
        id: user.id,
        email: user.email,
        displayName: user.displayName
      })}`);
      
      // First check existing memberships
      console.log(`Checking existing tenant memberships...`);
      const existingMemberships = await TenantMember.findAll({
        where: { userId: user.id },
        include: [
          { model: Tenant }
        ]
      });
      
      console.log(`Found ${existingMemberships.length} existing tenant memberships`);
      for (const membership of existingMemberships) {
        console.log(`Membership: ${JSON.stringify({
          id: membership.id,
          tenantId: membership.tenantId,
          role: membership.role,
          status: membership.status,
          tenantName: membership.tenant?.name,
          isPersonal: membership.tenant?.isPersonal
        })}`);
      }
      
      // Check for existing personal tenant
      console.log(`Checking for existing personal tenant for user ${userId}`);
      const existingPersonalTenants = await Tenant.findAll({
        where: { 
          ownerId: userId,
          isPersonal: true
        }
      });
      
      console.log(`Found ${existingPersonalTenants.length} existing personal tenants`);
      for (const pt of existingPersonalTenants) {
        console.log(`Personal tenant: ${JSON.stringify({
          id: pt.id,
          name: pt.name,
          ownerId: pt.ownerId,
          isPersonal: pt.isPersonal
        })}`);
      }
      
      let tenant: Tenant;
      
      if (existingPersonalTenants.length > 0) {
        tenant = existingPersonalTenants[0];
        console.log(`Using existing personal tenant: ${tenant.id}`);
      } else {
        // Create a new personal tenant from scratch
        const workspaceName = `${user.displayName || user.email}'s Workspace`;
        console.log(`Creating new personal tenant "${workspaceName}" for user ${userId}`);
        
        tenant = await Tenant.create({
          id: generateUUID(),
          name: workspaceName,
          ownerId: userId,
          isPersonal: true
        });
        
        console.log(`Created personal tenant: ${tenant.id}`);
      }
      
      // Check for membership
      const membership = await TenantMember.findOne({
        where: {
          tenantId: tenant.id,
          userId: userId
        }
      });
      
      if (!membership) {
        console.log(`Creating tenant membership for user ${userId} in tenant ${tenant.id}`);
        
        // Create the membership
        const newMembership = await TenantMember.create({
          id: generateUUID(),
          tenantId: tenant.id,
          userId: userId,
          role: TenantRole.OWNER,
          status: TenantMemberStatus.ACTIVE
        });
        
        console.log(`Created tenant membership: ${newMembership.id}`);
      } else {
        console.log(`Tenant membership already exists: ${membership.id}, role: ${membership.role}, status: ${membership.status}`);
        
        // Ensure the membership is active
        if (membership.status !== TenantMemberStatus.ACTIVE) {
          console.log(`Updating membership status to active`);
          membership.status = TenantMemberStatus.ACTIVE;
          await membership.save();
        }
      }
      
      // Double check - verify that the membership exists and is properly associated
      const verificationMembership = await TenantMember.findOne({
        where: {
          tenantId: tenant.id,
          userId: userId
        },
        include: [{ model: Tenant }]
      });
      
      if (!verificationMembership) {
        console.error(`CRITICAL: Membership still not found after creation!`);
      } else if (!verificationMembership.tenant) {
        console.error(`CRITICAL: Membership exists but tenant association is missing!`);
      } else {
        console.log(`Verified membership exists with proper tenant association: ${JSON.stringify({
          membershipId: verificationMembership.id,
          tenantId: verificationMembership.tenantId,
          tenantName: verificationMembership.tenant.name
        })}`);
      }
      
      // Verify the Sequelize associations are working properly
      console.log(`Verifying database associations...`);
      const directTenant = await Tenant.findByPk(tenant.id, {
        include: [
          {
            model: TenantMember,
            where: { userId }
          }
        ]
      });
      
      if (!directTenant) {
        console.error(`CRITICAL: Cannot find tenant with members association!`);
      } else if (!directTenant.members || directTenant.members.length === 0) {
        console.error(`CRITICAL: Tenant found but members association is empty!`);
      } else {
        console.log(`Verified tenant has proper members association: ${directTenant.members.length} members`);
      }
      
      // Get all tenants for verification using the service method
      console.log(`Getting all tenants through service layer...`);
      const allTenants = await tenantService.getUserTenants(userId, true);
      console.log(`Service returned ${allTenants.length} tenants`);
      
      res.json({
        success: true,
        message: 'Personal tenant created/verified successfully',
        tenant: {
          id: tenant.id,
          name: tenant.name,
          isPersonal: tenant.isPersonal,
          ownerId: tenant.ownerId,
          createdAt: tenant.createdAt
        },
        directTenantCheck: directTenant ? {
          tenantId: directTenant.id,
          memberCount: directTenant.members?.length || 0
        } : 'Association check failed',
        allTenants
      });
      
      console.log(`=== FORCE CREATE PERSONAL TENANT COMPLETED ===`);
    } catch (error) {
      console.error('Error forcing personal tenant creation:', error);
      res.status(500).json({ 
        success: false, 
        message: `Error creating personal tenant: ${(error as Error).message}` 
      });
    }
  });
}

export default new TenantController();