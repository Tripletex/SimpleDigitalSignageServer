/**
 * This file is kept for backward compatibility.
 * All device authentication now uses API keys instead of JWT tokens.
 * @deprecated Use apiKeyAuthMiddleware.ts instead
 */

import { requireApiKey, optionalApiKey } from './apiKeyAuthMiddleware';
import { Request, Response, NextFunction } from 'express';

/**
 * @deprecated Use requireApiKey from apiKeyAuthMiddleware.ts instead
 */
export const requireDeviceAuth = requireApiKey;

/**
 * @deprecated Use a combination of optionalApiKey and custom route handler logic instead
 */
export const excludeDeviceAuthRoutes = (paths: string[]) => {
  console.warn('[DEPRECATED] excludeDeviceAuthRoutes is deprecated, use optionalApiKey instead');
  return (req: Request, res: Response, next: NextFunction) => {
    if (paths.some(path => req.path === path)) {
      return next();
    }
    return requireApiKey(req, res, next);
  };
};