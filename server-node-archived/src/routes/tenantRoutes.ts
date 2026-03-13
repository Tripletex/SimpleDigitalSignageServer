import express, { Router } from 'express';
import tenantController from '../controllers/tenantController';
import { 
  requireTenantMember, 
  requireTenantAdmin, 
  requireTenantOwner,
  validateTenantIdParam 
} from '../middleware/tenantAuthorizationMiddleware';

class TenantRoutes {
  private router = express.Router();
  
  constructor() {
    // Get all tenants for the current user (no tenant-specific auth needed)
    this.router.get('/', tenantController.getUserTenants);
    
    // Create a new tenant (no tenant-specific auth needed)
    this.router.post('/', tenantController.createTenant);
    
    // Get a specific tenant - requires membership
    this.router.get('/:id', requireTenantMember, tenantController.getTenantDetails);
    
    // Update a tenant - requires admin or owner role
    this.router.put('/:id', requireTenantAdmin, tenantController.updateTenant);
    
    // Delete a tenant - requires owner role
    this.router.delete('/:id', requireTenantOwner, tenantController.deleteTenant);
    
    // Invite a user to a tenant - requires admin or owner role
    this.router.post('/:id/invite', requireTenantAdmin, tenantController.inviteUser);
    
    // Update a member's role - requires admin or owner role
    this.router.put('/:id/members/:userId/role', requireTenantAdmin, tenantController.updateMemberRole);
    
    // Remove a member from a tenant - requires admin or owner role
    this.router.delete('/:id/members/:userId', requireTenantAdmin, tenantController.removeMember);
    
    // Leave a tenant - requires membership (user can leave their own membership)
    this.router.post('/:id/leave', requireTenantMember, tenantController.leaveTenant);
    
    // Force create personal tenant (debugging) - no tenant-specific auth needed
    this.router.post('/personal/force-create', tenantController.forceCreatePersonalTenant);
    
    // Accept all pending invitations (no tenant-specific auth needed)
    this.router.post('/invitations/accept', tenantController.acceptPendingInvitations);
  }
  
  public getRouter(): Router {
    return this.router;
  }
}

export default new TenantRoutes().getRouter();