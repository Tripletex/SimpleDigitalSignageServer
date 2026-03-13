import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../../../shared/src/userData';

// Define extended session type
interface SessionWithAuth {
  userId?: string;
  username?: string;
  role?: string;
  challenge?: string;
  destroy(callback?: (err?: Error) => void): void;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Middleware to check if user is authenticated
 */
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  const session = req.session as SessionWithAuth;
  
  if (session && session.userId) {
    req.user = {
      id: session.userId,
      email: session.username as string, // username field contains email
      role: session.role as string
    };
    return next();
  }
  
  return res.status(401).json({
    success: false,
    message: 'Authentication required'
  });
};

/**
 * Middleware to check if user has admin role
 */
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === UserRole.ADMIN) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: 'Admin access required'
  });
};

/**
 * Middleware to exclude specific routes from authentication
 */
export const excludeRoutes = (paths: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Log the current path and exclusion list
    console.log(`[AUTH] Current path: ${req.path}`);
    console.log(`[AUTH] Excluded paths: ${JSON.stringify(paths)}`);
    
    // Check if the current path is in the exclusion list
    if (paths.includes(req.path)) {
      console.log(`[AUTH] Path ${req.path} is excluded from authentication`);
      return next();
    }
    
    // Otherwise apply authentication
    console.log(`[AUTH] Path ${req.path} requires authentication`);
    return isAuthenticated(req, res, next);
  };
};