import { Request, Response, NextFunction } from 'express';
import deviceApiKeyRepository from '../repositories/deviceApiKeyRepository';
import deviceRepository from '../repositories/deviceRepository';

// Create a more specific device info type
interface DeviceInfo {
  id: string;
  tenantId?: string;
}

// Extend Express Request interface to include device property only
declare global {
  namespace Express {
    interface Request {
      device?: DeviceInfo;
    }
  }
}

// Define Device interface that matches what deviceRepository.getDeviceById returns
interface Device {
  id: string;
  tenantId?: string;
  [key: string]: any; // Allow other properties
}

/**
 * Middleware to authenticate devices using API keys
 * API key can be provided in:
 * 1. Authorization header: "X-API-Key: {api_key}"
 * 2. Query parameter: "?apiKey={api_key}"
 * 3. Request body: { "apiKey": "{api_key}" }
 */
export const requireApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract API key from request (header, query, body)
    const apiKey = 
      req.headers['x-api-key'] as string || 
      req.query.apiKey as string || 
      (req.body && req.body.apiKey);
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key is required'
      });
    }
    
    // Validate API key
    const deviceId = await deviceApiKeyRepository.validateApiKey(apiKey);
    
    if (!deviceId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired API key'
      });
    }
    
    // Get device details
    const device = await deviceRepository.getDeviceById(deviceId) as Device | null;

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found'
      });
    }

    // Attach device info to request
    const deviceInfo: DeviceInfo = {
      id: deviceId,
      tenantId: device.tenantId
    };
    req.device = deviceInfo;
    
    // Continue to the next middleware/route handler
    next();
  } catch (error) {
    console.error('[API-KEY-AUTH] Error validating API key:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * Middleware that makes API key authentication optional
 * If API key is provided, it validates and attaches device info
 * If not provided, it continues without error
 */
export const optionalApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Extract API key from request (header, query, body)
    const apiKey = 
      req.headers['x-api-key'] as string || 
      req.query.apiKey as string || 
      (req.body && req.body.apiKey);
    
    // If no API key provided, continue without validation
    if (!apiKey) {
      return next();
    }
    
    // Validate API key
    const deviceId = await deviceApiKeyRepository.validateApiKey(apiKey);
    
    // If valid, attach device info to request
    if (deviceId) {
      const device = await deviceRepository.getDeviceById(deviceId) as Device | null;

      if (device) {
        const deviceInfo: DeviceInfo = {
          id: deviceId,
          tenantId: device.tenantId
        };
        req.device = deviceInfo;
      }
    }
    
    // Continue to the next middleware/route handler
    next();
  } catch (error) {
    // Just log the error and continue
    console.error('[API-KEY-AUTH] Error in optional API key validation:', error);
    next();
  }
};

/**
 * Middleware that requires either a valid API key or an authenticated user session.
 * API key is checked first. If absent or invalid, falls back to session auth.
 * Rejects with 401 if neither is present.
 */
export const requireApiKeyOrAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Step 1: Extract API key from request (header, query, body)
    const apiKey =
      req.headers['x-api-key'] as string ||
      req.query.apiKey as string ||
      (req.body && req.body.apiKey);

    // Step 2: If API key is present, attempt validation
    if (apiKey) {
      const deviceId = await deviceApiKeyRepository.validateApiKey(apiKey);

      if (deviceId) {
        const device = await deviceRepository.getDeviceById(deviceId) as Device | null;

        if (device) {
          const deviceInfo: DeviceInfo = {
            id: deviceId,
            tenantId: device.tenantId,
          };
          req.device = deviceInfo;
          return next();
        }
      }
      // API key was provided but invalid — fall through to session check
    }
  } catch (error) {
    // API key validation threw — log and fall through to session check
    console.error('[API-KEY-AUTH] Error in API key validation, falling back to session:', error);
  }

  // Step 3: Check session authentication
  const session = req.session as Record<string, any>;

  if (session && session.userId) {
    req.user = {
      id: session.userId,
      email: session.username as string,
      role: session.role as string,
    };
    return next();
  }

  // Step 4: Neither auth method succeeded
  return res.status(401).json({
    success: false,
    message: 'Authentication required: provide a valid API key or user session',
  });
};