import { Request, Response } from 'express';
import { handleErrors } from "../helpers/errorHandler";
import userService from '../services/userService';
import { Authenticator } from '../models/Authenticator';

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
  
  /**
   * Get current user's profile
   */
  public getProfile = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const user = await userService.getUserById(req.user.id);
    
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    
    // Access updatedAt safely using type assertions
    const updatedAt = (user as any).updatedAt || user.createdAt;
    
    res.json({
      success: true,
      profile: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: updatedAt,
        authenticatorCount: user.authenticators ? user.authenticators.length : 0
      }
    });
  });
  
  /**
   * Update current user's profile
   */
  public updateProfile = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { displayName } = req.body;
    
    if (!displayName || displayName.trim() === '') {
      res.status(400).json({ success: false, message: 'Display name is required' });
      return;
    }
    
    // Only allow updating display name for own profile
    const updatedUser = await userService.updateUser({
      id: req.user.id,
      displayName
    });
    
    if (!updatedUser) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        role: updatedUser.role
      }
    });
  });
  
  /**
   * Get user's passkeys
   */
  public getPasskeys = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    console.log(`Fetching passkeys for user: ${req.user.id}`);
    
    try {
      const authenticators = await Authenticator.findAll({
        where: { userId: req.user.id },
        order: [['createdAt', 'DESC']]
      });
      
      console.log(`Found ${authenticators.length} passkeys for user ${req.user.id}`);
      
      const passkeys = authenticators.map((auth, index) => ({
        id: auth.id,
        name: auth.name || `Passkey ${index + 1}`, // Use custom name if available, fallback to default
        createdAt: auth.createdAt
      }));
      
      res.json({
        success: true,
        passkeys
      });
    } catch (error) {
      console.error(`Error fetching passkeys: ${error}`);
      // Still return success with empty array to avoid breaking the UI
      res.json({
        success: true,
        passkeys: [],
        error: `Error fetching passkeys: ${error}`
      });
    }
  });
  
  /**
   * Update passkey name
   */
  public updatePasskeyName = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name || name.trim() === '') {
      res.status(400).json({ success: false, message: 'Name is required' });
      return;
    }
    
    console.log(`Updating passkey ${id} name to "${name}" for user ${req.user.id}`);
    
    try {
      // Find the authenticator and verify it belongs to the current user
      const authenticator = await Authenticator.findOne({
        where: { 
          id,
          userId: req.user.id 
        }
      });
      
      if (!authenticator) {
        res.status(404).json({ success: false, message: 'Passkey not found or does not belong to you' });
        return;
      }
      
      // Update the name
      authenticator.name = name.trim();
      await authenticator.save();
      
      console.log(`Passkey ${id} name updated successfully`);
      
      res.json({
        success: true,
        message: 'Passkey name updated successfully',
        passkey: {
          id: authenticator.id,
          name: authenticator.name,
          createdAt: authenticator.createdAt
        }
      });
    } catch (error) {
      console.error(`Error updating passkey name: ${error}`);
      res.status(500).json({ success: false, message: `Error updating passkey name: ${error}` });
    }
  });
  
  /**
   * Delete passkey
   */
  public deletePasskey = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { id } = req.params;
    console.log(`Deleting passkey ${id} for user ${req.user.id}`);
    
    try {
      // Find the authenticator and verify it belongs to the current user
      const authenticator = await Authenticator.findOne({
        where: { 
          id,
          userId: req.user.id 
        }
      });
      
      if (!authenticator) {
        res.status(404).json({ success: false, message: 'Passkey not found or does not belong to you' });
        return;
      }
      
      // Make sure it's not the last passkey
      const passkeyCount = await Authenticator.count({
        where: { userId: req.user.id }
      });
      
      if (passkeyCount <= 1) {
        res.status(400).json({ success: false, message: 'Cannot delete your only passkey' });
        return;
      }
      
      // Delete the passkey
      await authenticator.destroy();
      
      console.log(`Passkey ${id} deleted successfully`);
      
      res.json({
        success: true,
        message: 'Passkey deleted successfully'
      });
    } catch (error) {
      console.error(`Error deleting passkey: ${error}`);
      res.status(500).json({ success: false, message: `Error deleting passkey: ${error}` });
    }
  });
}

export default new UserController();