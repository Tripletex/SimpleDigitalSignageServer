import { Request, Response } from 'express';
import playlistService from '../services/playlistService';
import { PlaylistData } from '../../../shared/src/playlistData';
import { handleErrors } from "../helpers/errorHandler";
import { validateAndConvert } from '../validators/validate';
import { playlistSchema, playlistReorderSchema } from '../validators/playlistValidator';

class PlaylistController {
  /**
   * Get all playlists for the current tenant
   */
  public getPlaylists = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { tenantId } = req.params;
    
    const result = await playlistService.getPlaylistsByTenant(tenantId);
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  });

  /**
   * Get a specific playlist by ID
   */
  public getPlaylistById = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { id } = req.params;
    
    const result = await playlistService.getPlaylistById(id);
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }
  });

  /**
   * Create a new playlist
   */
  public createPlaylist = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { tenantId } = req.params;
    const playlistData = await validateAndConvert<PlaylistData>(req, playlistSchema);
    
    const result = await playlistService.createPlaylist(
      playlistData,
      req.user.id,
      tenantId
    );
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  });

  /**
   * Update an existing playlist
   */
  public updatePlaylist = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { tenantId, id } = req.params;
    const playlistData = await validateAndConvert<PlaylistData>(req, playlistSchema);
    
    const result = await playlistService.updatePlaylist(
      id,
      playlistData,
      req.user.id,
      tenantId
    );
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  });

  /**
   * Delete a playlist
   */
  public deletePlaylist = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { tenantId, id } = req.params;
    
    const result = await playlistService.deletePlaylist(
      id,
      req.user.id,
      tenantId
    );
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  });

  /**
   * Reorder playlist items
   */
  public reorderPlaylistItems = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { tenantId, id } = req.params;
    const { itemIds } = await validateAndConvert<{ itemIds: string[] }>(req, playlistReorderSchema);
    
    const result = await playlistService.reorderPlaylistItems(
      id,
      itemIds,
      req.user.id,
      tenantId
    );
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  });
}

export default new PlaylistController();