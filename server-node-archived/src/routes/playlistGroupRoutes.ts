import express, { Router } from 'express';
import playlistGroupController from '../controllers/playlistGroupController';
import { isAuthenticated } from '../middleware/authMiddleware';
import { requireTenantMember, validateTenantIdParam } from '../middleware/tenantAuthorizationMiddleware';

class PlaylistGroupRoutes {
  private router = express.Router();
  
  constructor() {
    // All playlist group routes require authentication
    this.router.use(isAuthenticated);
    
    // Get playlist groups for a specific tenant - requires tenant membership
    this.router.get('/tenant/:tenantId/playlist-groups', 
      validateTenantIdParam('tenantId'), 
      playlistGroupController.getPlaylistGroups
    );
    
    // Create a new playlist group - requires tenant membership
    this.router.post('/tenant/:tenantId/playlist-groups', 
      validateTenantIdParam('tenantId'), 
      playlistGroupController.createPlaylistGroup
    );
    
    // Get playlist group by ID - requires access validation in controller
    this.router.get('/playlist-groups/:id', playlistGroupController.getPlaylistGroupById);
    
    // Update playlist group - requires tenant membership
    this.router.put('/tenant/:tenantId/playlist-groups/:id', 
      validateTenantIdParam('tenantId'), 
      playlistGroupController.updatePlaylistGroup
    );
    
    // Delete playlist group - requires tenant membership
    this.router.delete('/tenant/:tenantId/playlist-groups/:id', 
      validateTenantIdParam('tenantId'), 
      playlistGroupController.deletePlaylistGroup
    );
    
    // Add schedule to playlist group - requires tenant membership
    this.router.post('/tenant/:tenantId/playlist-groups/:id/schedules', 
      validateTenantIdParam('tenantId'), 
      playlistGroupController.addSchedule
    );
    
    // Delete schedule from playlist group - requires tenant membership
    this.router.delete('/tenant/:tenantId/playlist-groups/:id/schedules/:scheduleId', 
      validateTenantIdParam('tenantId'), 
      playlistGroupController.deleteSchedule
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default new PlaylistGroupRoutes().getRouter();