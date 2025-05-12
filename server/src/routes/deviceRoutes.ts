// routes/deviceRoutes.ts
import express, {Router} from 'express';
import deviceController from '../controllers/deviceController';
import { requireApiKey, optionalApiKey } from '../middleware/apiKeyAuthMiddleware';

class DeviceRoutes {
  private router = express.Router();
  
  constructor() {
    // Public endpoints (don't require auth)
    // -----------------------
    
    // Device registration endpoint
    this.router.post('/register', deviceController.registerDevice);
    
    // Device ping endpoint - secured with API key authentication
    this.router.post('/ping', requireApiKey, deviceController.pingDevice);
    
    // Protected endpoints (requiring JWT auth can be added later)
    // -----------------------
    
    // Protected endpoints (require user auth)
    // -----------------------
    
    // Get active ping data - now using optional API key auth
    this.router.get('/list', optionalApiKey, deviceController.getAllDevices);

    // Get all registered devices - now using optional API key auth
    this.router.get('/registered', optionalApiKey, deviceController.getAllRegisteredDevices);
    
    // Tenant-specific device endpoints
    // -----------------------
    
    // Get devices for a specific tenant
    this.router.get('/tenant/:tenantId/devices', deviceController.getTenantDevices);
    
    // Claim a device for a tenant
    this.router.post('/tenant/:tenantId/claim', deviceController.claimDevice);
    
    // Release a device from a tenant
    this.router.delete('/tenant/:tenantId/devices/:deviceId', deviceController.releaseDevice);
    
    // Assign a campaign to a device
    this.router.post('/tenant/:tenantId/devices/:deviceId/campaign', deviceController.assignCampaign);
    
    // Get a specific device by ID
    // IMPORTANT: This must be after the other routes to avoid conflicts
    this.router.get('/:id', optionalApiKey, deviceController.getDeviceById);
  }

  public getRouter():Router {
    return this.router;
  }
}

export default new DeviceRoutes().getRouter();