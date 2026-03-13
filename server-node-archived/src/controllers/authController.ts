import { Request, Response } from 'express';
import { handleErrors } from "../helpers/errorHandler";
import { validateAndConvert } from '../validators/validate';
import { userRegisterSchema } from '../validators/userValidator';
import { UserRegisterRequest, UserRole } from '../../../shared/src/userData';
import { TenantRole, TenantMemberStatus } from '../../../shared/src/tenantData';
import userService from '../services/userService';
import webauthnService from '../services/webauthnService';
import tenantService from '../services/tenantService';
import tenantRepository from '../repositories/tenantRepository';
import emailVerificationService from '../services/emailVerificationService';
import sequelize from '../config/database';
import { User } from '../models/User';

// Using the Session type defined in types/express-session.d.ts

/**
 * Authentication Controller
 * 
 * Registration flow:
 * 1. User provides their email address via /self-register
 * 2. System generates a verification token and sends a link to that email
 *    - In development: Link is logged to console and returned in response
 *    - In production: Link is sent via email (implementation required)
 * 3. User clicks the verification link, which calls /verify-email/:token
 * 4. If token is valid, user's email is stored in session as "verified"
 * 5. User completes registration with their display name via /complete-registration
 * 6. User account is created and user is logged in
 * 7. User registers a passkey for future authentication
 * 
 * This flow ensures that users verify email ownership before account creation
 * and prevents users from registering with email addresses they don't control.
 */
class AuthController {
  /**
   * Verify email token and setup user for registration
   */
  public verifyEmailToken = handleErrors(async (req: Request, res: Response): Promise<void> => {
    const { token } = req.params;
    
    if (!token) {
      res.status(400).json({ success: false, message: 'Token is required' });
      return;
    }
    
    console.log(`Verifying email token: ${token.substring(0, 8)}...`);
    
    // Verify the token
    const verification = await emailVerificationService.verifyEmailToken(token);
    
    if (!verification) {
      res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired verification token' 
      });
      return;
    }
    
    // Store verified email in session for registration
    req.session.verifiedEmail = verification.email;
    req.session.isFirstUser = verification.isFirstUser;
    
    // If this is an invitation, store invitation details
    if (verification.isInvitation) {
      req.session.invitingTenantId = verification.invitingTenantId;
      req.session.invitedRole = verification.invitedRole;
    }
    
    // Save session and respond only after persistence is confirmed
    req.session.save((err) => {
      if (err) {
        console.error('Error saving session during verification:', err);
        res.status(500).json({
          success: false,
          message: 'Error saving verification session'
        });
        return;
      }

      console.log('Session saved successfully with verified email:', req.session.verifiedEmail);

      const message = verification.isInvitation
        ? `You've been invited to join an organization. Please complete registration.`
        : 'Email verified successfully';

      res.json({
        success: true,
        message,
        email: verification.email,
        isFirstUser: verification.isFirstUser,
        isInvitation: verification.isInvitation,
        invitingTenant: verification.invitingTenantId
          ? { id: verification.invitingTenantId }
          : undefined
      });
    });
  });
  
  /**
   * Complete registration with verified email
   */
  public completeRegistration = handleErrors(async (req: Request, res: Response): Promise<void> => {
    // Check if email was verified
    if (!req.session.verifiedEmail) {
      res.status(400).json({ 
        success: false, 
        message: 'Email verification required before registration' 
      });
      return;
    }
    
    const email = req.session.verifiedEmail;
    const displayName = req.body.displayName || email.split('@')[0];

    console.log(`Completing registration for verified email: ${email}`);

    // Check if user already exists (shouldn't happen, but just in case)
    const existingUser = await userService.getUserByEmail(email);
    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
      return;
    }

    // Atomic first-user determination and user creation (CWE-362 fix)
    // Do NOT trust req.session.isFirstUser — it was set at email verification time
    // and may be stale if another user registered between verification and completion.
    // Advisory lock serializes concurrent first-user checks across all sessions.
    const user = await sequelize.transaction(async (t) => {
      await sequelize.query('SELECT pg_advisory_xact_lock(1)', { transaction: t });
      const userCount = await User.count({ transaction: t });
      const role = userCount === 0 ? UserRole.ADMIN : UserRole.USER;
      return await userService.createUser(email, displayName, role, t);
    });
    
    // Create personal tenant
    await tenantService.createPersonalTenantForUser(user.id, user.email, user.displayName);
    
    // Handle invitation if present
    const invitingTenantId = req.session.invitingTenantId;
    const invitedRole = req.session.invitedRole;
    
    if (invitingTenantId && invitedRole) {
      console.log(`Handling invitation for user ${user.id} to tenant ${invitingTenantId} with role ${invitedRole}`);
      
      try {
        // Add the user to the inviting tenant
        await tenantRepository.addTenantMember(
          invitingTenantId,
          user.id, 
          invitedRole as TenantRole,
          TenantMemberStatus.ACTIVE // Make it active immediately
        );
        
        console.log(`Added user ${user.id} to tenant ${invitingTenantId} with role ${invitedRole}`);
      } catch (error) {
        console.error(`Error adding user to invited tenant: ${error}`);
        // Continue with registration even if tenant membership fails
      }
    }
    
    // Regenerate session to prevent session fixation (also clears old verification data)
    req.session.regenerate((err) => {
      if (err) {
        console.error('Error regenerating session:', err);
        res.status(500).json({
          success: false,
          message: 'Error creating secure session'
        });
        return;
      }

      // Set user session for WebAuthn registration
      req.session.userId = user.id;
      req.session.username = user.email;
      req.session.role = user.role;

      // Save session before responding to ensure persistence
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Error saving session:', saveErr);
          res.status(500).json({
            success: false,
            message: 'Error saving session'
          });
          return;
        }

        res.status(201).json({
          success: true,
          message: 'Registration completed successfully',
          user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            role: user.role
          }
        });
      });
    });
  });
  
  /**
   * Register a new user (admin only - for creating additional users)
   */
  public registerUser = handleErrors(async (req: Request, res: Response): Promise<void> => {
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
   * Initiate user registration (public endpoint)
   * Only collects email and sends verification link
   */
  public selfRegister = handleErrors(async (req: Request, res: Response): Promise<void> => {
    console.log('Self-register request received');
    console.log('Request body:', req.body);
    
    // Basic email validation - more relaxed in development
    const emailRegex = process.env.NODE_ENV === 'production' 
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/ // Stricter validation in production
      : /^.+@.+\..+$/; // Basic validation in development
      
    if (!req.body.email || !emailRegex.test(req.body.email)) {
      res.status(400).json({ 
        success: false, 
        message: 'Valid email address is required' 
      });
      return;
    }
    
    const email = req.body.email;
    
    // Check if user already exists
    const existingUser = await userService.getUserByEmail(email);
    if (existingUser) {
      // Don't reveal if user exists for security reasons
      res.status(200).json({
        success: true,
        message: 'If your email is valid, a verification link will be sent to it'
      });
      return;
    }
    
    // Check if this is the first user
    const isFirstUser = (await userService.getAllUsers()).length === 0;
    
    // Create a verification token
    const token = await emailVerificationService.createEmailVerificationToken(email, isFirstUser);
    
    // Build the verification link
    const verificationLink = `${process.env.BASE_URL || 'http://localhost:3000'}/verify-email/${token}`;
    
    // In production, send an email with the verification link
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement email sending in production
      console.log(`[PRODUCTION] Would send verification email to ${email} with link: ${verificationLink}`);
      
      res.status(200).json({
        success: true,
        message: 'Verification link has been sent to your email'
      });
    } else {
      // In development, log the link and return it in the response for easy testing
      console.log(`\n===== DEVELOPMENT MODE =====`);
      console.log(`Verification link for ${email}:`);
      console.log(`${verificationLink}`);
      console.log(`=============================\n`);
      
      // Check if this is the first user (who should be admin)
      const existingUsers = await userService.getAllUsers();
      console.log(`Found ${existingUsers.length} existing users`);
      const isFirstUser = existingUsers.length === 0;
      
      // For development, return the verification link in the response
      res.status(200).json({
        success: true,
        message: 'Verification link has been sent to your email (see console log for details)',
        // Development-only fields
        dev: {
          note: "These fields are only included in development mode",
          verificationLink,
          token,
          isFirstUser,
          directApiVerify: `/api/auth/verify-email/${token}`
        }
      });
    }
  });

  /**
   * Get registration options for WebAuthn
   */
  public getRegistrationOptions = handleErrors(async (req: Request, res: Response): Promise<void> => {
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
  public verifyRegistration = handleErrors(async (req: Request, res: Response): Promise<void> => {
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
  public getAuthenticationOptions = handleErrors(async (req: Request, res: Response): Promise<void> => {
    // Generate authentication options
    const options = await webauthnService.generateAuthenticationOptions(req.body.email);
    
    // Store challenge in session for later verification
    req.session.challenge = options.challenge;
    
    res.json(options);
  });

  /**
   * Verify authentication response for WebAuthn
   */
  public verifyAuthentication = handleErrors(async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('Verifying authentication...');
      
      // Get challenge from session
      const challenge = req.session.challenge;
      if (!challenge) {
        console.log('Authentication challenge not found in session');
        res.status(400).json({ 
          success: false, 
          message: 'Authentication challenge not found in session' 
        });
        return;
      }
      
      // Clear challenge from session
      delete req.session.challenge;
      
      // Verify authentication
      console.log('Authenticating with challenge:', challenge.substring(0, 10) + '...');
      const { verified, user } = await webauthnService.verifyAuthentication(
        req.body,
        challenge
      );
      
      if (verified && user) {
        console.log(`User authenticated: ${user.email}`);
        
        // Activate any pending tenant memberships
        try {
          const tenantRepository = (await import('../repositories/tenantRepository')).default;
          await tenantRepository.activatePendingMemberships(user.id);
          console.log(`Activated pending memberships for user ${user.id}`);
        } catch (error) {
          console.error('Error activating pending memberships:', error);
          // Continue login process even if this fails
        }
        
        // Regenerate session to prevent session fixation
        req.session.regenerate((err) => {
          if (err) {
            console.error('Error regenerating session:', err);
            res.status(500).json({
              success: false,
              message: 'Error creating secure session'
            });
            return;
          }

          // Set user session data on the new session
          req.session.userId = user.id;
          req.session.username = user.email;
          req.session.role = user.role;

          // Save the new session
          req.session.save((saveErr) => {
            if (saveErr) {
              console.error('Error saving session:', saveErr);
              res.status(500).json({
                success: false,
                message: 'Error saving session'
              });
              return;
            }

            console.log('Session saved successfully');
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
          });
        });
      } else {
        console.log('Authentication verification failed');
        res.status(401).json({ 
          success: false, 
          message: 'Authentication failed' 
        });
      }
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'development'
          ? `Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`
          : 'Authentication error'
      });
    }
  });

  /**
   * Get current user info
   */
  public getCurrentUser = handleErrors(async (req: Request, res: Response): Promise<void> => {
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
  public logout = handleErrors(async (req: Request, res: Response): Promise<void> => {
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