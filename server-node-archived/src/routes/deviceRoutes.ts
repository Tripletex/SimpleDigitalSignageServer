// routes/deviceRoutes.ts
import express, {Router} from 'express';
import rateLimit from 'express-rate-limit';
import deviceController from '../controllers/deviceController';
import { requireApiKey, requireApiKeyOrAuth } from '../middleware/apiKeyAuthMiddleware';
import { isAuthenticated } from '../middleware/authMiddleware';
import { validateTenantIdParam } from '../middleware/tenantAuthorizationMiddleware';

const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many device registrations from this IP, please try again later' },
});

class DeviceRoutes {
  private router = express.Router();
  
  constructor() {
    // Device registration - rate limited to prevent mass device creation
    // Security boundary is the claim step (/tenant/:tenantId/claim), not registration
    // -----------------------

    this.router.post('/register', registerRateLimit, deviceController.registerDevice);
    
    // Device ping endpoint - secured with API key authentication
    this.router.post('/ping', requireApiKey, deviceController.pingDevice);
    
    // Protected endpoints (require valid API key or user session)
    // -----------------------

    // Get active ping data - requires API key or authenticated session
    this.router.get('/list', requireApiKeyOrAuth, deviceController.getAllDevices);

    // Get all registered devices - requires API key or authenticated session
    this.router.get('/registered', requireApiKeyOrAuth, deviceController.getAllRegisteredDevices);
    
    // Tenant-specific device endpoints (require user authentication and tenant membership)
    // -----------------------
    
    // Get devices for a specific tenant - requires tenant membership
    this.router.get('/tenant/:tenantId/devices', 
      isAuthenticated, 
      validateTenantIdParam('tenantId'), 
      deviceController.getTenantDevices
    );
    
    // Claim a device for a tenant - requires tenant membership
    this.router.post('/tenant/:tenantId/claim', 
      isAuthenticated, 
      validateTenantIdParam('tenantId'), 
      deviceController.claimDevice
    );
    
    // Release a device from a tenant - requires tenant membership
    this.router.delete('/tenant/:tenantId/devices/:deviceId', 
      isAuthenticated, 
      validateTenantIdParam('tenantId'), 
      deviceController.releaseDevice
    );
    
    // Assign a campaign to a device - requires tenant membership
    this.router.post('/tenant/:tenantId/devices/:deviceId/campaign', 
      isAuthenticated, 
      validateTenantIdParam('tenantId'), 
      deviceController.assignCampaign
    );
    
    // Get a specific device by ID - requires API key or authenticated session
    // IMPORTANT: This must be after the other routes to avoid conflicts
    this.router.get('/:id', requireApiKeyOrAuth, deviceController.getDeviceById);
  }

  public getRouter():Router {
    return this.router;
  }
}

export default new DeviceRoutes().getRouter();