import express, { Router } from 'express';
import tenantController from '../controllers/tenantController';

class TenantRoutes {
  private router = express.Router();
  
  constructor() {
    // Get all tenants for the current user
    this.router.get('/', tenantController.getUserTenants);
    
    // Create a new tenant
    this.router.post('/', tenantController.createTenant);
    
    // Get a specific tenant
    this.router.get('/:id', tenantController.getTenantDetails);
    
    // Update a tenant
    this.router.put('/:id', tenantController.updateTenant);
    
    // Delete a tenant
    this.router.delete('/:id', tenantController.deleteTenant);
    
    // Invite a user to a tenant
    this.router.post('/:id/invite', tenantController.inviteUser);
    
    // Update a member's role
    this.router.put('/:id/members/:userId/role', tenantController.updateMemberRole);
    
    // Remove a member from a tenant
    this.router.delete('/:id/members/:userId', tenantController.removeMember);
    
    // Leave a tenant
    this.router.post('/:id/leave', tenantController.leaveTenant);
    
    // Force create personal tenant (debugging)
    this.router.post('/personal/force-create', tenantController.forceCreatePersonalTenant);
    
    // Accept all pending invitations
    this.router.post('/invitations/accept', tenantController.acceptPendingInvitations);
  }
  
  public getRouter(): Router {
    return this.router;
  }
}

export default new TenantRoutes().getRouter();