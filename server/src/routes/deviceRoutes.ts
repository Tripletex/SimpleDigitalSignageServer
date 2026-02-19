// routes/deviceRoutes.ts
import express, {Router} from 'express';
import deviceController from '../controllers/deviceController';
import { requireApiKey, optionalApiKey } from '../middleware/apiKeyAuthMiddleware';
import { isAuthenticated } from '../middleware/authMiddleware';
import { validateTenantIdParam } from '../middleware/tenantAuthorizationMiddleware';

class DeviceRoutes {
  private router = express.Router();
  
  constructor() {
    // Public endpoints (don't require auth)
    // -----------------------
    
    // Device registration endpoint
    this.router.post('/register', deviceController.registerDevice);
    
    // Device ping endpoint - secured with API key authentication
    this.router.post('/ping', requireApiKey, deviceController.pingDevice);
    
    // Protected endpoints (require user auth)
    // -----------------------
    
    // Get active ping data - using optional API key auth for device access
    this.router.get('/list', optionalApiKey, deviceController.getAllDevices);

    // Get all registered devices - using optional API key auth for device access
    this.router.get('/registered', optionalApiKey, deviceController.getAllRegisteredDevices);
    
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
    
    // Get a specific device by ID - using optional API key auth for device access
    // IMPORTANT: This must be after the other routes to avoid conflicts
    this.router.get('/:id', optionalApiKey, deviceController.getDeviceById);
  }

  public getRouter():Router {
    return this.router;
  }
}

export default new DeviceRoutes().getRouter();