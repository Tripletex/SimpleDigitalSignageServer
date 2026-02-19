import { Request, Response } from 'express';
import { handleErrors } from "../helpers/errorHandler";
import userService from '../services/userService';
import { Authenticator } from '../models/Authenticator';
import { validateQueryParams } from '../validators/validate';
import { sanitizeString } from '../middleware/xssProtectionMiddleware';

class UserController {
  /**
   * Get all users (admin only)
   * Enhanced with XSS protection and input validation
   */
  public getAllUsers = handleErrors(async (req: Request, res: Response): Promise<void> => {
    // Validate and sanitize query parameters
    const allowedParams = ['search', 'role', 'limit', 'offset'];
    const queryParams = validateQueryParams(req, allowedParams);
    
    const users = await userService.getAllUsers();
    
    // Apply search filter if provided
    let filteredUsers = users;
    if (queryParams.search) {
      const searchTerm = queryParams.search.toLowerCase();
      filteredUsers = users.filter(user => 
        user.email.toLowerCase().includes(searchTerm) ||
        user.displayName?.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply role filter if provided
    if (queryParams.role) {
      filteredUsers = filteredUsers.filter(user => user.role === queryParams.role);
    }
    
    // Map users to safe response format with XSS protection
    const safeUsers = filteredUsers.map(user => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName, // Already sanitized by middleware
      role: user.role,
      createdAt: user.createdAt,
      authenticatorCount: user.authenticators ? user.authenticators.length : 0
    }));
    
    res.json({
      success: true,
      users: safeUsers,
      total: safeUsers.length
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
   * Enhanced with comprehensive input validation and XSS protection
   */
  public updateProfile = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { displayName } = req.body;
    
    // Enhanced validation with XSS protection
    if (!displayName || typeof displayName !== 'string' || displayName.trim() === '') {
      res.status(400).json({ 
        success: false, 
        message: 'Display name is required and must be a valid string' 
      });
      return;
    }
    
    // Additional length validation
    const sanitizedDisplayName = sanitizeString(displayName.trim(), {
      maxLength: 100,
      allowHtml: false
    });
    
    if (sanitizedDisplayName.length < 1) {
      res.status(400).json({ 
        success: false, 
        message: 'Display name cannot be empty after sanitization' 
      });
      return;
    }
    
    if (sanitizedDisplayName.length > 100) {
      res.status(400).json({ 
        success: false, 
        message: 'Display name must be 100 characters or less' 
      });
      return;
    }
    
    // Only allow updating display name for own profile
    const updatedUser = await userService.updateUser({
      id: req.user.id,
      displayName: sanitizedDisplayName
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
        displayName: updatedUser.displayName, // Already sanitized
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
   * Enhanced with XSS protection and comprehensive validation
   */
  public updatePasskeyName = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { id } = req.params;
    const { name } = req.body;
    
    // Enhanced validation with XSS protection
    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ 
        success: false, 
        message: 'Passkey name is required and must be a valid string' 
      });
      return;
    }
    
    // Sanitize and validate the passkey name
    const sanitizedName = sanitizeString(name.trim(), {
      maxLength: 50,
      allowHtml: false
    });
    
    if (sanitizedName.length < 1) {
      res.status(400).json({ 
        success: false, 
        message: 'Passkey name cannot be empty after sanitization' 
      });
      return;
    }
    
    if (sanitizedName.length > 50) {
      res.status(400).json({ 
        success: false, 
        message: 'Passkey name must be 50 characters or less' 
      });
      return;
    }
    
    console.log(`Updating passkey ${id} name to "${sanitizedName}" for user ${req.user.id}`);
    
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
      
      // Update the name with sanitized value
      authenticator.name = sanitizedName;
      await authenticator.save();
      
      console.log(`Passkey ${id} name updated successfully`);
      
      res.json({
        success: true,
        message: 'Passkey name updated successfully',
        passkey: {
          id: authenticator.id,
          name: authenticator.name, // Already sanitized
          createdAt: authenticator.createdAt
        }
      });
    } catch (error) {
      console.error(`Error updating passkey name: ${error}`);
      res.status(500).json({ success: false, message: 'Error updating passkey name' });
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