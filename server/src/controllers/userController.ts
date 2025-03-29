import { Request, Response } from 'express';
import { handleErrors } from "../helpers/errorHandler";
import userService from '../services/userService';

class UserController {
  /**
   * Get all users (admin only)
   */
  public getAllUsers = handleErrors(async (req: Request, res: Response): Promise<void> => {
    const users = await userService.getAllUsers();
    
    // Map users to safe response format
    const safeUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt,
      authenticatorCount: user.authenticators ? user.authenticators.length : 0
    }));
    
    res.json({
      success: true,
      users: safeUsers
    });
  });

  /**
   * Get user by ID (admin only)
   */
  public getUserById = handleErrors(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const user = await userService.getUserById(id);
    
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    
    // Return safe user object
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        createdAt: user.createdAt,
        authenticatorCount: user.authenticators ? user.authenticators.length : 0
      }
    });
  });

  /**
   * Update user (admin only)
   */
  public updateUser = handleErrors(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { displayName, email, role } = req.body;
    
    // Update only allowed fields
    const updatedUser = await userService.updateUser({
      id,
      displayName,
      email,
      role
    });
    
    if (!updatedUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    
    res.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        role: updatedUser.role
      }
    });
  });

  /**
   * Delete user (admin only)
   */
  public deleteUser = handleErrors(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    
    // Check if deleting self
    if (req.user && req.user.id === id) {
      res.status(400).json({ 
        success: false, 
        message: 'Cannot delete your own account' 
      });
      return;
    }
    
    await userService.deleteUser(id);
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  });
}

export default new UserController();