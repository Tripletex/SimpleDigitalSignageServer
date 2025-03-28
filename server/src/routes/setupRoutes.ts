import express, { Router } from 'express';
import setupController from '../controllers/setupController';

class SetupRoutes {
  private router = express.Router();
  
  constructor() {
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