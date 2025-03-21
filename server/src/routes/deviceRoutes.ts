// routes/deviceRoutes.ts
import express, {Router} from 'express';
import deviceController from '../controllers/deviceController';

class DeviceRoutes {
  private router = express.Router();
  
  constructor() {
    // Device registration endpoint
    this.router.post('/register', deviceController.registerDevice);
    
    // Device ping endpoint
    this.router.post('/ping', deviceController.pingDevice);
    
    // Get active ping data
    this.router.get('/list', deviceController.getAllDevices);
    
    // Get all registered devices (with or without ping data)
    this.router.get('/registered', deviceController.getAllRegisteredDevices);
    
    // Get a specific device by ID
    this.router.get('/:id', deviceController.getDeviceById);
  }

  public getRouter():Router {
    return this.router;
  }
}

export default new DeviceRoutes().getRouter();