import { Request, Response } from 'express';
import { handleErrors } from "../helpers/errorHandler";
import { validateAndConvert } from '../validators/validate';
import { userRegisterSchema } from '../validators/userValidator';
import { UserRegisterRequest, UserRole } from '../../../shared/src/userData';
import userService from '../services/userService';
import webauthnService from '../services/webauthnService';

// Using the Session type defined in types/express-session.d.ts

class AuthController {
  /**
   * Register a new user (admin only - for creating additional users)
   */
  public registerUser = handleErrors(async (req: Request, res: Response) => {
    // Only admins can create new users
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      res.status(403).json({ 
        success: false, 
        message: 'Only administrators can create new users' 
      });
      return;
    }
    
    const userRequest = await validateAndConvert<UserRegisterRequest>(req, userRegisterSchema);
    const user = await userService.createUser(
      userRequest.email,
      userRequest.displayName
    );
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role
      }
    });
  });

  /**
   * Register a new user (public endpoint - for self-registration)
   * The first user to register will automatically become an admin
   */
  public selfRegister = handleErrors(async (req: Request, res: Response) => {
    console.log('Self-register request received');
    console.log('Request body:', req.body);
    
    const userRequest = await validateAndConvert<UserRegisterRequest>(req, userRegisterSchema);
    console.log('Validated user request:', userRequest);
    
    // Check if this is the first user (who should be admin)
    const existingUsers = await userService.getAllUsers();
    console.log(`Found ${existingUsers.length} existing users`);
    const isFirstUser = existingUsers.length === 0;
    const role = isFirstUser ? UserRole.ADMIN : UserRole.USER;
    
    // Create the user with appropriate role
    const user = await userService.createUser(
      userRequest.email,
      userRequest.displayName,
      role
    );
    
    // Set the user in session so they can register an authenticator
    req.session.userId = user.id;
    req.session.username = user.email;
    req.session.role = user.role;
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role
      }
    });
  });

  /**
   * Get registration options for WebAuthn
   */
  public getRegistrationOptions = handleErrors(async (req: Request, res: Response) => {
    // Make sure user is authenticated
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    // Get user from database
    const user = await userService.getUserById(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    
    // Generate registration options
    const options = await webauthnService.generateRegistrationOptions(
      user.id,
      user.email,
      user.displayName || user.email.split('@')[0]
    );
    
    // Store challenge in session for later verification
    req.session.challenge = options.challenge;
    
    res.json(options);
  });

  /**
   * Verify registration response for WebAuthn
   */
  public verifyRegistration = handleErrors(async (req: Request, res: Response) => {
    console.log('WebAuthn registration verification request received');
    
    // Make sure user is authenticated
    if (!req.user) {
      console.log('User not authenticated');
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    console.log('User is authenticated:', req.user);
    
    // Get challenge from session
    const challenge = req.session.challenge;
    if (!challenge) {
      console.log('Challenge not found in session');
      res.status(400).json({ 
        success: false, 
        message: 'Registration challenge not found in session' 
      });
      return;
    }
    
    console.log('Challenge found in session:', challenge);
    
    // Clear challenge from session
    delete req.session.challenge;
    
    console.log('Registration verification payload:', req.body);
    
    // Verify registration
    const verification = await webauthnService.verifyRegistration(
      req.user.id,
      req.body,
      challenge
    );
    
    if (verification.verified) {
      res.json({
        success: true,
        message: 'Registration successful'
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Registration verification failed' 
      });
    }
  });

  /**
   * Get authentication options for WebAuthn
   */
  public getAuthenticationOptions = handleErrors(async (req: Request, res: Response) => {
    // Generate authentication options
    const options = await webauthnService.generateAuthenticationOptions(req.body.email);
    
    // Store challenge in session for later verification
    req.session.challenge = options.challenge;
    
    res.json(options);
  });

  /**
   * Verify authentication response for WebAuthn
   */
  public verifyAuthentication = handleErrors(async (req: Request, res: Response) => {
    // Get challenge from session
    const challenge = req.session.challenge;
    if (!challenge) {
      res.status(400).json({ 
        success: false, 
        message: 'Authentication challenge not found in session' 
      });
      return;
    }
    
    // Clear challenge from session
    delete req.session.challenge;
    
    // Verify authentication
    const { verified, user } = await webauthnService.verifyAuthentication(
      req.body,
      challenge
    );
    
    if (verified && user) {
      // Set user session
      req.session.userId = user.id;
      req.session.username = user.email; // Use email as username
      req.session.role = user.role;
      
      res.json({
        success: true,
        message: 'Authentication successful',
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role
        }
      });
    } else {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication failed' 
      });
    }
  });

  /**
   * Get current user info
   */
  public getCurrentUser = handleErrors(async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const user = await userService.getUserById(req.user.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        authenticatorCount: user.authenticators ? user.authenticators.length : 0
      }
    });
  });

  /**
   * Logout current user
   */
  public logout = handleErrors(async (req: Request, res: Response) => {
    req.session.destroy((err: Error | null) => {
      if (err) {
        res.status(500).json({ success: false, message: 'Error during logout' });
        return;
      }
      
      res.json({ success: true, message: 'Logout successful' });
    });
  });
}

export default new AuthController();