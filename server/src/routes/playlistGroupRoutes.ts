import express, { Router } from 'express';
import playlistGroupController from '../controllers/playlistGroupController';
import { isAuthenticated } from '../middleware/authMiddleware';

class PlaylistGroupRoutes {
  private router = express.Router();
  
  constructor() {
    // All playlist group routes require authentication
    this.router.use(isAuthenticated);
    
    // Get playlist groups for a specific tenant
    this.router.get('/tenant/:tenantId/playlist-groups', playlistGroupController.getPlaylistGroups);
    
    // Create a new playlist group
    this.router.post('/tenant/:tenantId/playlist-groups', playlistGroupController.createPlaylistGroup);
    
    // Get playlist group by ID
    this.router.get('/playlist-groups/:id', playlistGroupController.getPlaylistGroupById);
    
    // Update playlist group
    this.router.put('/tenant/:tenantId/playlist-groups/:id', playlistGroupController.updatePlaylistGroup);
    
    // Delete playlist group
    this.router.delete('/tenant/:tenantId/playlist-groups/:id', playlistGroupController.deletePlaylistGroup);
    
    // Add schedule to playlist group
    this.router.post('/tenant/:tenantId/playlist-groups/:id/schedules', playlistGroupController.addSchedule);
    
    // Delete schedule from playlist group
    this.router.delete('/tenant/:tenantId/playlist-groups/:id/schedules/:scheduleId', playlistGroupController.deleteSchedule);
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default new PlaylistGroupRoutes().getRouter();