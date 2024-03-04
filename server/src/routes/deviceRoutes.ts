// routes/deviceRoutes.ts
import express, {Router} from 'express';
import deviceController from '../controllers/deviceController';


class DeviceRoutes {
  private  router = express.Router();
  constructor() {
    this.router.post('/register', deviceController.registerDevice);
    this.router.get('/list', deviceController.getAllDevices);
  }

  public getRouter():Router {
    return this.router;
  }
}

export default new DeviceRoutes().getRouter();