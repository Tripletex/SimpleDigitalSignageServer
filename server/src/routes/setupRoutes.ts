import express, { Router } from 'express';
import setupController from '../controllers/setupController';
import { isAuthenticated } from '../middleware/authMiddleware';

class SetupRoutes {
  private router = express.Router();

  constructor() {
    // Health check endpoint (available in all environments)
    this.router.get('/health', setupController.healthCheck);

    // Debug and development endpoints (development only)
    if (process.env.NODE_ENV === 'development') {
      // Debug endpoints require authentication even in development
      this.router.get('/debug/tenants', isAuthenticated, setupController.debugUserTenants);
      this.router.get('/debug/tenants/orm', isAuthenticated, setupController.debugTenantsWithModels);
      this.router.get('/debug/users/orm', isAuthenticated, setupController.debugUsersWithModels);
      this.router.get('/debug/verify-associations', isAuthenticated, setupController.verifyAssociations);

      // Destructive operation
      this.router.post('/dev/reset-users', isAuthenticated, setupController.resetUsers);
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default new SetupRoutes().getRouter();