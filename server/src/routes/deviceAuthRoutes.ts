// routes/deviceAuthRoutes.ts
import express, { Router } from 'express';
import deviceAuthController from '../controllers/deviceAuthController';

class DeviceAuthRoutes {
  private router = express.Router();
  
  constructor() {
    // Step 1: Generate a challenge
    this.router.post('/challenge', deviceAuthController.generateChallenge);
    
    // Step 2: Verify the challenge response and get a token
    this.router.post('/verify', deviceAuthController.verifyChallenge);
  }
  
  public getRouter(): Router {
    return this.router;
  }
}

export default new DeviceAuthRoutes().getRouter();