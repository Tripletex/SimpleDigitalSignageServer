import express, { Router, Request, Response, NextFunction } from 'express';
import deviceAuthController from '../controllers/deviceAuthController';

/**
 * Error handling wrapper to prevent server crashes
 */
const safeHandler = (handler: (req: Request, res: Response, next?: NextFunction) => Promise<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log(`[AUTH ROUTE] Processing ${req.method} ${req.path}`);
      await handler(req, res, next);
    } catch (error) {
      console.error(`[AUTH ROUTE] Uncaught error in route handler:`, error);
      if (error instanceof Error) {
        console.error(`[AUTH ROUTE] Error stack:`, error.stack);
      }
      
      // Try to send an error response if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Internal server error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      } else {
        console.error(`[AUTH ROUTE] Headers already sent, could not send error response`);
      }
    }
  };
};

class DeviceAuthRoutes {
  private router = express.Router();
  
  constructor() {
    // Apply detailed logging middleware specifically for device auth endpoints
    this.router.use((req, res, next) => {
      const requestId = Math.random().toString(36).substring(2, 10);
      console.log(`[DEVICE AUTH][${requestId}] ${new Date().toISOString()} - ${req.method} ${req.path}`);
      
      // Log request details
      try {
        const headers = { ...req.headers };
        // Redact any sensitive headers
        if (headers.authorization) {
          headers.authorization = headers.authorization.substring(0, 15) + '...';
        }
        
        console.log(`[DEVICE AUTH][${requestId}] Headers: ${JSON.stringify(headers)}`);
        
        // Log request body but truncate long values like signatures or keys
        if (req.body) {
          const body = { ...req.body };
          
          // Truncate potentially large base64 strings for readability
          if (body.signature && typeof body.signature === 'string') {
            body.signature = body.signature.substring(0, 40) + '... [truncated]';
          }
          
          if (body.publicKey && typeof body.publicKey === 'string') {
            body.publicKey = body.publicKey.substring(0, 40) + '... [truncated]';
          }
          
          console.log(`[DEVICE AUTH][${requestId}] Body: ${JSON.stringify(body)}`);
        }
        
        // Log response data for this request
        const oldSend = res.send;
        res.send = function(body) {
          const responseData = body ? 
            (typeof body === 'string' ? body : JSON.stringify(body)) : '';
          
          // Log truncated response
          console.log(`[DEVICE AUTH][${requestId}] Response: ${
            responseData.length > 200 ? 
              responseData.substring(0, 200) + '... [truncated]' : 
              responseData
          }`);
          
          // Use Function.apply with explicit arguments and proper typing
          return oldSend.apply(this, [body] as unknown as [body?: any]);
        };
      } catch (loggingError) {
        console.error(`[DEVICE AUTH][${requestId}] Error in logging middleware:`, loggingError);
      }
      
      next();
    });
    
    // Step 1: Generate a challenge - wrapped with error handler
    this.router.post('/challenge', safeHandler(deviceAuthController.generateChallenge));
    
    // Step 2: Verify the challenge response and get a token - wrapped with error handler
    this.router.post('/verify', safeHandler(deviceAuthController.verifyChallenge));
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default new DeviceAuthRoutes().getRouter();