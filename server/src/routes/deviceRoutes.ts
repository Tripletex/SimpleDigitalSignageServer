// routes/deviceRoutes.ts
import express, {Router} from 'express';
import deviceController from '../controllers/deviceController';
import { requireDeviceAuth } from '../middleware/deviceAuthMiddleware';

class DeviceRoutes {
  private router = express.Router();
  
  constructor() {
    // Public endpoints (don't require auth)
    // -----------------------
    
    // Device registration endpoint
    this.router.post('/register', deviceController.registerDevice);
    
    // Device ping endpoint - secured with JWT authentication
    this.router.post('/ping', requireDeviceAuth, deviceController.pingDevice);
    
    // Protected endpoints (requiring JWT auth can be added later)
    // -----------------------
    
    // Protected endpoints (require user auth)
    // -----------------------
    
    // Get active ping data - requires user auth or device auth
    this.router.get('/list', deviceController.getAllDevices);
    
    // Get all registered devices (with or without ping data)
    this.router.get('/registered', deviceController.getAllRegisteredDevices);
    
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
    this.router.get('/:id', deviceController.getDeviceById);
  }

  public getRouter():Router {
    return this.router;
  }
}

export default new DeviceRoutes().getRouter();