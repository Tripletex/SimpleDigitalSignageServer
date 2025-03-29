import express, { Router } from 'express';
import authController from '../controllers/authController';
import { isAuthenticated, isAdmin } from '../middleware/authMiddleware';

class AuthRoutes {
  private router = express.Router();
  
  constructor() {
    // User management (admin only)
    this.router.post('/register', isAuthenticated, authController.registerUser);
    
    // Email verification based registration
    this.router.post('/self-register', authController.selfRegister);
    this.router.get('/verify-email/:token', authController.verifyEmailToken);
    this.router.post('/complete-registration', authController.completeRegistration);
    
    // Development-only direct verification route (makes testing easier)
    if (process.env.NODE_ENV !== 'production') {
      this.router.get('/dev/verify/:token', authController.verifyEmailToken);
    }
    
    // WebAuthn registration
    this.router.get('/webauthn/registration-options', isAuthenticated, authController.getRegistrationOptions);
    this.router.post('/webauthn/register', isAuthenticated, authController.verifyRegistration);
    
    // WebAuthn authentication (public endpoints)
    this.router.post('/webauthn/authentication-options', authController.getAuthenticationOptions);
    this.router.post('/webauthn/authenticate', authController.verifyAuthentication);
    
    // User info
    this.router.get('/me', isAuthenticated, authController.getCurrentUser);
    
    // Logout
    this.router.post('/logout', isAuthenticated, authController.logout);
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default new AuthRoutes().getRouter();