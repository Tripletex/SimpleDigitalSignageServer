import { Request, Response } from 'express';
import playlistGroupService from '../services/playlistGroupService';
import { PlaylistGroupData, PlaylistScheduleData } from '../../../shared/src/playlistData';
import { handleErrors } from "../helpers/errorHandler";
import { validateAndConvert } from '../validators/validate';
import { playlistGroupSchema, playlistScheduleSchema } from '../validators/playlistGroupValidator';

class PlaylistGroupController {
  /**
   * Get all playlist groups for the current tenant
   */
  public getPlaylistGroups = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { tenantId } = req.params;
    
    const result = await playlistGroupService.getPlaylistGroupsByTenant(tenantId);
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  });

  /**
   * Get a specific playlist group by ID
   */
  public getPlaylistGroupById = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { id } = req.params;
    
    const result = await playlistGroupService.getPlaylistGroupById(id);
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(404).json(result);
    }
  });

  /**
   * Create a new playlist group
   */
  public createPlaylistGroup = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { tenantId } = req.params;
    const groupData = await validateAndConvert<PlaylistGroupData>(req, playlistGroupSchema);
    
    const result = await playlistGroupService.createPlaylistGroup(
      groupData,
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
   * Update an existing playlist group
   */
  public updatePlaylistGroup = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { tenantId, id } = req.params;
    const groupData = await validateAndConvert<PlaylistGroupData>(req, playlistGroupSchema);
    
    const result = await playlistGroupService.updatePlaylistGroup(
      id,
      groupData,
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
   * Delete a playlist group
   */
  public deletePlaylistGroup = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { tenantId, id } = req.params;
    
    const result = await playlistGroupService.deletePlaylistGroup(
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
   * Add a schedule to a playlist group
   */
  public addSchedule = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { tenantId, id } = req.params;
    const scheduleData = await validateAndConvert<PlaylistScheduleData>(req, playlistScheduleSchema);
    
    const result = await playlistGroupService.addPlaylistSchedule(
      id,
      scheduleData,
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
   * Delete a schedule from a playlist group
   */
  public deleteSchedule = handleErrors(async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    
    const { tenantId, id, scheduleId } = req.params;
    
    const result = await playlistGroupService.deletePlaylistSchedule(
      id,
      scheduleId,
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

export default new PlaylistGroupController();