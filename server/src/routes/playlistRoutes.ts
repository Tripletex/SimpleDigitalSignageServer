import express, { Router } from 'express';
import playlistController from '../controllers/playlistController';
import { isAuthenticated } from '../middleware/authMiddleware';
import { requireTenantMember, validateTenantIdParam } from '../middleware/tenantAuthorizationMiddleware';

class PlaylistRoutes {
  private router = express.Router();
  
  constructor() {
    // All playlist routes require authentication
    this.router.use(isAuthenticated);
    
    // Get playlists for a specific tenant - requires tenant membership
    this.router.get('/tenant/:tenantId/playlists', 
      validateTenantIdParam('tenantId'), 
      playlistController.getPlaylists
    );
    
    // Create a new playlist - requires tenant membership
    this.router.post('/tenant/:tenantId/playlists', 
      validateTenantIdParam('tenantId'), 
      playlistController.createPlaylist
    );
    
    // Get playlist by ID - requires access validation in controller
    this.router.get('/playlists/:id', playlistController.getPlaylistById);
    
    // Update playlist - requires tenant membership
    this.router.put('/tenant/:tenantId/playlists/:id', 
      validateTenantIdParam('tenantId'), 
      playlistController.updatePlaylist
    );
    
    // Delete playlist - requires tenant membership
    this.router.delete('/tenant/:tenantId/playlists/:id', 
      validateTenantIdParam('tenantId'), 
      playlistController.deletePlaylist
    );
    
    // Reorder playlist items - requires tenant membership
    this.router.post('/tenant/:tenantId/playlists/:id/reorder', 
      validateTenantIdParam('tenantId'), 
      playlistController.reorderPlaylistItems
    );
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default new PlaylistRoutes().getRouter();