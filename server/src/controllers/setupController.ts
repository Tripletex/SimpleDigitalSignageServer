import { Request, Response } from 'express';
import { handleErrors } from "../helpers/errorHandler";
import { validateAndConvert } from '../validators/validate';
import { userRegisterSchema } from '../validators/userValidator';
import { UserRegisterRequest, UserRole } from '../../../shared/src/userData';
import userService from '../services/userService';
import userRepository from '../repositories/userRepository';

class SetupController {
  /**
   * Create initial admin user if no users exist
   */
  public initialSetup = handleErrors(async (req: Request, res: Response) => {
    // Check if any users exist
    const users = await userRepository.getAllUsers();
    console.log(`Initial setup: Found ${users.length} existing users`);
    if (users.length > 0) {
      console.log('Users already exist, preventing initial setup');
      res.status(400).json({ 
        success: false, 
        message: 'Setup already completed. Users already exist in the system.' 
      });
      return;
    }
    
    console.log('Request body for initial setup:', req.body);
    const userRequest = await validateAndConvert<UserRegisterRequest>(req, userRegisterSchema);
    console.log('Validated request:', userRequest);
    
    // Create the first user as admin
    const user = await userService.createUser(
      userRequest.email,
      userRequest.displayName,
      UserRole.ADMIN
    );
    
    // Set the user in session so they can register an authenticator
    if (req.session) {
      // TypeScript might not recognize these properties, but they're defined in our types/express-session.d.ts
      (req.session as any).userId = user.id;
      (req.session as any).username = user.email;
      (req.session as any).role = user.role;
    }
    
    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role
      }
    });
  });

  /**
   * Reset all users (DEVELOPMENT ONLY)
   * This is a destructive operation that deletes all users and their authenticators
   */
  public resetUsers = handleErrors(async (req: Request, res: Response) => {
    // Only allow in development environment
    if (process.env.NODE_ENV !== 'development') {
      res.status(403).json({
        success: false,
        message: 'This operation is only available in development mode'
      });
      return;
    }

    try {
      console.log('Attempting to reset all users...');
      // Get all users
      const users = await userRepository.getAllUsers();
      console.log(`Found ${users.length} users to delete`);
      
      // Delete each user
      for (const user of users) {
        console.log(`Deleting user: ${user.email} (${user.id})`);
        await userRepository.deleteUser(user.id);
      }
      
      // Verify users were deleted
      const remainingUsers = await userRepository.getAllUsers();
      console.log(`After deletion: ${remainingUsers.length} users remain`);
      
      res.json({
        success: true,
        message: `Successfully deleted ${users.length} users`
      });
    } catch (error) {
      console.error('Error resetting users:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset users'
      });
    }
  });
}

export default new SetupController();