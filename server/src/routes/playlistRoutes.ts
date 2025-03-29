import express, { Router } from 'express';
import playlistController from '../controllers/playlistController';
import { isAuthenticated } from '../middleware/authMiddleware';

class PlaylistRoutes {
  private router = express.Router();
  
  constructor() {
    // All playlist routes require authentication
    this.router.use(isAuthenticated);
    
    // Get playlists for a specific tenant
    this.router.get('/tenant/:tenantId/playlists', playlistController.getPlaylists);
    
    // Create a new playlist
    this.router.post('/tenant/:tenantId/playlists', playlistController.createPlaylist);
    
    // Get playlist by ID
    this.router.get('/playlists/:id', playlistController.getPlaylistById);
    
    // Update playlist
    this.router.put('/tenant/:tenantId/playlists/:id', playlistController.updatePlaylist);
    
    // Delete playlist
    this.router.delete('/tenant/:tenantId/playlists/:id', playlistController.deletePlaylist);
    
    // Reorder playlist items
    this.router.post('/tenant/:tenantId/playlists/:id/reorder', playlistController.reorderPlaylistItems);
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default new PlaylistRoutes().getRouter();