import playlistGroupRepository from '../repositories/playlistGroupRepository';
import playlistRepository from '../repositories/playlistRepository';
import { PlaylistGroup } from '../models/PlaylistGroup';
import { PlaylistSchedule } from '../models/PlaylistSchedule';
import { 
  PlaylistGroupData, 
  PlaylistScheduleData, 
  PlaylistGroupResponse, 
  PlaylistGroupsResponse 
} from '../../../shared/src/playlistData';

class PlaylistGroupService {
  /**
   * Map playlist group from model to shared type
   */
  mapPlaylistGroupToShared(group: PlaylistGroup): PlaylistGroupData {
    const mappedGroup: PlaylistGroupData = {
      id: group.id,
      name: group.name,
      description: group.description,
      tenantId: group.tenantId,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };

    // Map schedules if they exist
    if (group.schedules && group.schedules.length > 0) {
      mappedGroup.schedules = group.schedules.map(schedule => ({
        id: schedule.id,
        playlistId: schedule.playlistId,
        start: schedule.start,
        end: schedule.end,
        days: schedule.days
      }));
    } else {
      mappedGroup.schedules = [];
    }

    return mappedGroup;
  }

  /**
   * Get all playlist groups for a tenant
   */
  async getPlaylistGroupsByTenant(tenantId: string): Promise<PlaylistGroupsResponse> {
    try {
      const groups = await playlistGroupRepository.getPlaylistGroupsByTenant(tenantId);
      return {
        success: true,
        message: 'Playlist groups retrieved successfully',
        playlistGroups: groups.map(group => this.mapPlaylistGroupToShared(group))
      };
    } catch (error) {
      console.error('Error getting playlist groups:', error);
      return {
        success: false,
        message: `Failed to get playlist groups: ${error instanceof Error ? error.message : String(error)}`,
        playlistGroups: []
      };
    }
  }

  /**
   * Get a playlist group by ID
   */
  async getPlaylistGroupById(id: string): Promise<PlaylistGroupResponse> {
    try {
      const group = await playlistGroupRepository.getPlaylistGroupById(id);
      return {
        success: true,
        message: 'Playlist group retrieved successfully',
        playlistGroup: this.mapPlaylistGroupToShared(group)
      };
    } catch (error) {
      console.error(`Error getting playlist group ${id}:`, error);
      return {
        success: false,
        message: `Failed to get playlist group: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Create a new playlist group
   */
  async createPlaylistGroup(groupData: PlaylistGroupData, userId: string, tenantId: string): Promise<PlaylistGroupResponse> {
    try {
      // Verify all playlists exist and belong to the tenant
      if (groupData.schedules && groupData.schedules.length > 0) {
        for (const schedule of groupData.schedules) {
          try {
            const playlist = await playlistRepository.getPlaylistById(schedule.playlistId);
            if (playlist.tenantId !== tenantId) {
              return {
                success: false,
                message: `Playlist with ID ${schedule.playlistId} does not belong to this tenant`
              };
            }
          } catch (error) {
            return {
              success: false,
              message: `Playlist with ID ${schedule.playlistId} not found`
            };
          }
        }
      }

      const group = await playlistGroupRepository.createPlaylistGroup(groupData, userId, tenantId);
      return {
        success: true,
        message: 'Playlist group created successfully',
        playlistGroup: this.mapPlaylistGroupToShared(group)
      };
    } catch (error) {
      console.error('Error creating playlist group:', error);
      return {
        success: false,
        message: `Failed to create playlist group: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Update an existing playlist group
   */
  async updatePlaylistGroup(id: string, groupData: PlaylistGroupData, userId: string, tenantId: string): Promise<PlaylistGroupResponse> {
    try {
      // Verify group belongs to the tenant
      const existingGroup = await playlistGroupRepository.getPlaylistGroupById(id);
      if (existingGroup.tenantId !== tenantId) {
        return {
          success: false,
          message: 'You do not have permission to update this playlist group'
        };
      }

      // Verify all playlists exist and belong to the tenant
      if (groupData.schedules && groupData.schedules.length > 0) {
        for (const schedule of groupData.schedules) {
          try {
            const playlist = await playlistRepository.getPlaylistById(schedule.playlistId);
            if (playlist.tenantId !== tenantId) {
              return {
                success: false,
                message: `Playlist with ID ${schedule.playlistId} does not belong to this tenant`
              };
            }
          } catch (error) {
            return {
              success: false,
              message: `Playlist with ID ${schedule.playlistId} not found`
            };
          }
        }
      }

      const group = await playlistGroupRepository.updatePlaylistGroup(id, groupData);
      return {
        success: true,
        message: 'Playlist group updated successfully',
        playlistGroup: this.mapPlaylistGroupToShared(group)
      };
    } catch (error) {
      console.error(`Error updating playlist group ${id}:`, error);
      return {
        success: false,
        message: `Failed to update playlist group: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Delete a playlist group
   */
  async deletePlaylistGroup(id: string, userId: string, tenantId: string): Promise<PlaylistGroupResponse> {
    try {
      // Verify group belongs to the tenant
      const existingGroup = await playlistGroupRepository.getPlaylistGroupById(id);
      if (existingGroup.tenantId !== tenantId) {
        return {
          success: false,
          message: 'You do not have permission to delete this playlist group'
        };
      }

      const deleted = await playlistGroupRepository.deletePlaylistGroup(id);
      if (deleted) {
        return {
          success: true,
          message: 'Playlist group deleted successfully'
        };
      } else {
        return {
          success: false,
          message: 'Failed to delete playlist group'
        };
      }
    } catch (error) {
      console.error(`Error deleting playlist group ${id}:`, error);
      return {
        success: false,
        message: `Failed to delete playlist group: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Add a schedule to a playlist group
   */
  async addPlaylistSchedule(
    groupId: string, 
    scheduleData: PlaylistScheduleData, 
    userId: string, 
    tenantId: string
  ): Promise<PlaylistGroupResponse> {
    try {
      // Verify group belongs to the tenant
      const existingGroup = await playlistGroupRepository.getPlaylistGroupById(groupId);
      if (existingGroup.tenantId !== tenantId) {
        return {
          success: false,
          message: 'You do not have permission to update this playlist group'
        };
      }

      // Verify playlist exists and belongs to the tenant
      try {
        const playlist = await playlistRepository.getPlaylistById(scheduleData.playlistId);
        if (playlist.tenantId !== tenantId) {
          return {
            success: false,
            message: `Playlist with ID ${scheduleData.playlistId} does not belong to this tenant`
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `Playlist with ID ${scheduleData.playlistId} not found`
        };
      }

      // Validate time format
      const startTimeParts = scheduleData.start.split(':').map(Number);
      const endTimeParts = scheduleData.end.split(':').map(Number);
      
      if (startTimeParts.length !== 2 || endTimeParts.length !== 2 ||
          startTimeParts.some(isNaN) || endTimeParts.some(isNaN) ||
          startTimeParts[0] < 0 || startTimeParts[0] > 23 || 
          startTimeParts[1] < 0 || startTimeParts[1] > 59 ||
          endTimeParts[0] < 0 || endTimeParts[0] > 23 || 
          endTimeParts[1] < 0 || endTimeParts[1] > 59) {
        return {
          success: false,
          message: 'Invalid time format. Please use HH:MM format (24-hour)'
        };
      }
      
      // Validate start time is before end time
      const startMinutes = startTimeParts[0] * 60 + startTimeParts[1];
      const endMinutes = endTimeParts[0] * 60 + endTimeParts[1];
      
      if (startMinutes >= endMinutes) {
        return {
          success: false,
          message: 'End time must be after start time'
        };
      }
      
      // Check for time overlaps on the same days
      if (existingGroup.schedules) {
        const hasOverlap = existingGroup.schedules.some(schedule => {
          // Check if any days overlap
          const daysOverlap = schedule.days.some(day => scheduleData.days.includes(day));
          if (!daysOverlap) return false;
          
          // Convert schedule times to minutes for comparison
          const scheduleStartParts = schedule.start.split(':').map(Number);
          const scheduleEndParts = schedule.end.split(':').map(Number);
          const scheduleStartMinutes = scheduleStartParts[0] * 60 + scheduleStartParts[1];
          const scheduleEndMinutes = scheduleEndParts[0] * 60 + scheduleEndParts[1];
          
          // Check for overlap
          // Overlap occurs if:
          // - new start time is within existing schedule, or
          // - new end time is within existing schedule, or
          // - new schedule completely encloses existing schedule
          return (
            (startMinutes >= scheduleStartMinutes && startMinutes < scheduleEndMinutes) ||
            (endMinutes > scheduleStartMinutes && endMinutes <= scheduleEndMinutes) ||
            (startMinutes <= scheduleStartMinutes && endMinutes >= scheduleEndMinutes)
          );
        });
        
        if (hasOverlap) {
          return {
            success: false,
            message: 'This schedule overlaps with an existing schedule on the same day(s). Please adjust the times or days.'
          };
        }
      }

      await playlistGroupRepository.addPlaylistSchedule(groupId, scheduleData);
      
      // Get updated group
      const updatedGroup = await playlistGroupRepository.getPlaylistGroupById(groupId);
      
      return {
        success: true,
        message: 'Schedule added successfully',
        playlistGroup: this.mapPlaylistGroupToShared(updatedGroup)
      };
    } catch (error) {
      console.error(`Error adding schedule to group ${groupId}:`, error);
      return {
        success: false,
        message: `Failed to add schedule: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Delete a playlist schedule
   */
  async deletePlaylistSchedule(
    groupId: string,
    scheduleId: string, 
    userId: string, 
    tenantId: string
  ): Promise<PlaylistGroupResponse> {
    try {
      // Verify group belongs to the tenant
      const existingGroup = await playlistGroupRepository.getPlaylistGroupById(groupId);
      if (existingGroup.tenantId !== tenantId) {
        return {
          success: false,
          message: 'You do not have permission to update this playlist group'
        };
      }

      // Verify schedule belongs to the group
      const scheduleExists = existingGroup.schedules?.some(s => s.id === scheduleId);
      if (!scheduleExists) {
        return {
          success: false,
          message: 'Schedule not found in this group'
        };
      }

      const deleted = await playlistGroupRepository.deletePlaylistSchedule(scheduleId);
      
      if (deleted) {
        // Get updated group
        const updatedGroup = await playlistGroupRepository.getPlaylistGroupById(groupId);
        
        return {
          success: true,
          message: 'Schedule deleted successfully',
          playlistGroup: this.mapPlaylistGroupToShared(updatedGroup)
        };
      } else {
        return {
          success: false,
          message: 'Failed to delete schedule'
        };
      }
    } catch (error) {
      console.error(`Error deleting schedule ${scheduleId}:`, error);
      return {
        success: false,
        message: `Failed to delete schedule: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

export default new PlaylistGroupService();