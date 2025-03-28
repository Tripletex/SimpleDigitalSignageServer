import express, { Router } from 'express';
import userController from '../controllers/userController';
import { isAuthenticated, isAdmin } from '../middleware/authMiddleware';

class UserRoutes {
  private router = express.Router();
  
  constructor() {
    // Admin only routes
    this.router.get('/', isAuthenticated, isAdmin, userController.getAllUsers);
    this.router.get('/:id', isAuthenticated, isAdmin, userController.getUserById);
    this.router.put('/:id', isAuthenticated, isAdmin, userController.updateUser);
    this.router.delete('/:id', isAuthenticated, isAdmin, userController.deleteUser);
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default new UserRoutes().getRouter();