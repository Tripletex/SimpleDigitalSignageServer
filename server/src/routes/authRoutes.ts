import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authController from '../controllers/authController';
import { isAuthenticated, isAdmin } from '../middleware/authMiddleware';
import { csrfTokenHandler } from '../middleware/csrfMiddleware';

// Rate limiter for authentication endpoints (login, verify)
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts from this IP, please try again later' },
});

// Stricter rate limiter for self-registration
const selfRegisterRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts from this IP, please try again later' },
});

class AuthRoutes {
  private router = express.Router();
  
  constructor() {
    // User management (admin only)
    this.router.post('/register', isAuthenticated, authController.registerUser);
    
    // Email verification based registration
    this.router.post('/self-register', selfRegisterRateLimit, authController.selfRegister);
    this.router.get('/verify-email/:token', authRateLimit, authController.verifyEmailToken);
    this.router.post('/complete-registration', authController.completeRegistration);
    
    // Development-only direct verification route (makes testing easier)
    if (process.env.NODE_ENV !== 'production') {
      this.router.get('/dev/verify/:token', authController.verifyEmailToken);
    }
    
    // WebAuthn registration
    this.router.get('/webauthn/registration-options', isAuthenticated, authController.getRegistrationOptions);
    this.router.post('/webauthn/register', isAuthenticated, authController.verifyRegistration);
    
    // WebAuthn authentication (public endpoints)
    this.router.post('/webauthn/authentication-options', authRateLimit, authController.getAuthenticationOptions);
    this.router.post('/webauthn/authenticate', authRateLimit, authController.verifyAuthentication);
    
    // User info
    this.router.get('/me', isAuthenticated, authController.getCurrentUser);
    
    // CSRF token endpoint - only needs a session (not full auth) so it works
    // during registration flow after email verification sets the session.
    this.router.get('/csrf-token', csrfTokenHandler);

    // Logout
    this.router.post('/logout', isAuthenticated, authController.logout);
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default new AuthRoutes().getRouter();