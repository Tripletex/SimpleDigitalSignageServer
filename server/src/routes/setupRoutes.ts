import express, { Router } from 'express';
import setupController from '../controllers/setupController';

class SetupRoutes {
  private router = express.Router();
  
  constructor() {
    // Health check endpoint
    this.router.get('/health', setupController.healthCheck);
    
    // Debug endpoint for tenant relationships
    this.router.get('/debug/tenants', setupController.debugUserTenants);
    
    // New ORM-based debug endpoints
    this.router.get('/debug/tenants/orm', setupController.debugTenantsWithModels);
    this.router.get('/debug/users/orm', setupController.debugUsersWithModels);
    this.router.get('/debug/verify-associations', setupController.verifyAssociations);
    
    // Development/testing endpoint to reset users (WARNING: destructive operation)
    if (process.env.NODE_ENV === 'development') {
      this.router.post('/dev/reset-users', setupController.resetUsers);
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default new SetupRoutes().getRouter();