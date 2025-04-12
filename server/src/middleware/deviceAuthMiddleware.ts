import { Request, Response, NextFunction } from 'express';
import { verifyDeviceToken } from '../utils/jwt';

// Extend Express Request interface to include device property
declare global {
  namespace Express {
    interface Request {
      device?: {
        id: string;
      };
    }
  }
}

/**
 * Middleware to verify device JWT tokens
 */
export const requireDeviceAuth = (req: Request, res: Response, next: NextFunction) => {
  // Get the authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please provide a valid token.'
    });
  }
  
  // Extract the token
  const token = authHeader.split(' ')[1];
  
  // Verify the token
  const decoded = verifyDeviceToken(token);
  
  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please authenticate again.'
    });
  }
  
  // Add device info to the request
  req.device = {
    id: decoded.sub
  };
  
  // Continue to the next middleware/route handler
  next();
};

/**
 * Middleware to exclude certain routes from authentication
 */
export const excludeDeviceAuthRoutes = (paths: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check if the current path is in the exclusion list
    if (paths.some(path => req.path === path)) {
      return next();
    }
    
    // Apply authentication for all other routes
    return requireDeviceAuth(req, res, next);
  };
};