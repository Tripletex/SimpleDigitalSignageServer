import playlistRepository from '../repositories/playlistRepository';
import { Playlist } from '../models/Playlist';
import { PlaylistData, PlaylistItemData, PlaylistResponse, PlaylistsResponse } from '../../../shared/src/playlistData';

class PlaylistService {
  /**
   * Map playlist from model to shared type
   */
  mapPlaylistToShared(playlist: Playlist): PlaylistData {
    const mappedPlaylist: PlaylistData = {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      tenantId: playlist.tenantId,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
    };

    // Map items if they exist
    if (playlist.items && playlist.items.length > 0) {
      mappedPlaylist.items = playlist.items.map(item => {
        // Create base mapped item
        const mappedItem: PlaylistItemData = {
          id: item.id,
          type: item.type,
          duration: item.duration,
          position: item.position
        };
        
        // Handle URL according to item type
        if (item.type === 'URL' || item.type === 'IMAGE' || item.type === 'YOUTUBE') {
          // Safely extract URL from JSONB storage
          if (item.url && typeof item.url === 'object') {
            try {
              // Handle both string and object formats for backwards compatibility
              const urlObj = item.url as any;
              if (urlObj.location && typeof urlObj.location === 'string') {
                mappedItem.url = { location: urlObj.location };
              } else {
                console.warn(`Invalid URL structure for item ${item.id}, type ${item.type}`);
              }
            } catch (err) {
              console.error(`Error parsing URL for item ${item.id}:`, err);
            }
          }
        }
        
        return mappedItem;
      }).sort((a, b) => (a.position || 0) - (b.position || 0));
    } else {
      mappedPlaylist.items = [];
    }

    return mappedPlaylist;
  }

  /**
   * Get all playlists for a tenant
   */
  async getPlaylistsByTenant(tenantId: string): Promise<PlaylistsResponse> {
    try {
      const playlists = await playlistRepository.getPlaylistsByTenant(tenantId);
      return {
        success: true,
        message: 'Playlists retrieved successfully',
        playlists: playlists.map(playlist => this.mapPlaylistToShared(playlist))
      };
    } catch (error) {
      console.error('Error getting playlists:', error);
      return {
        success: false,
        message: `Failed to get playlists: ${error instanceof Error ? error.message : String(error)}`,
        playlists: []
      };
    }
  }

  /**
   * Get a playlist by ID
   */
  async getPlaylistById(id: string): Promise<PlaylistResponse> {
    try {
      const playlist = await playlistRepository.getPlaylistById(id);
      return {
        success: true,
        message: 'Playlist retrieved successfully',
        playlist: this.mapPlaylistToShared(playlist)
      };
    } catch (error) {
      console.error(`Error getting playlist ${id}:`, error);
      return {
        success: false,
        message: `Failed to get playlist: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Create a new playlist
   */
  async createPlaylist(playlistData: PlaylistData, userId: string, tenantId: string): Promise<PlaylistResponse> {
    try {
      const playlist = await playlistRepository.createPlaylist(playlistData, userId, tenantId);
      return {
        success: true,
        message: 'Playlist created successfully',
        playlist: this.mapPlaylistToShared(playlist)
      };
    } catch (error) {
      console.error('Error creating playlist:', error);
      return {
        success: false,
        message: `Failed to create playlist: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Update an existing playlist
   */
  async updatePlaylist(id: string, playlistData: PlaylistData, userId: string, tenantId: string): Promise<PlaylistResponse> {
    try {
      // Verify playlist belongs to the tenant
      const existingPlaylist = await playlistRepository.getPlaylistById(id);
      if (existingPlaylist.tenantId !== tenantId) {
        return {
          success: false,
          message: 'You do not have permission to update this playlist'
        };
      }

      const playlist = await playlistRepository.updatePlaylist(id, playlistData);
      return {
        success: true,
        message: 'Playlist updated successfully',
        playlist: this.mapPlaylistToShared(playlist)
      };
    } catch (error) {
      console.error(`Error updating playlist ${id}:`, error);
      return {
        success: false,
        message: `Failed to update playlist: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Delete a playlist
   */
  async deletePlaylist(id: string, userId: string, tenantId: string): Promise<PlaylistResponse> {
    try {
      // Verify playlist belongs to the tenant
      const existingPlaylist = await playlistRepository.getPlaylistById(id);
      if (existingPlaylist.tenantId !== tenantId) {
        return {
          success: false,
          message: 'You do not have permission to delete this playlist'
        };
      }

      const deleted = await playlistRepository.deletePlaylist(id);
      if (deleted) {
        return {
          success: true,
          message: 'Playlist deleted successfully'
        };
      } else {
        return {
          success: false,
          message: 'Failed to delete playlist'
        };
      }
    } catch (error) {
      console.error(`Error deleting playlist ${id}:`, error);
      return {
        success: false,
        message: `Failed to delete playlist: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Reorder playlist items
   */
  async reorderPlaylistItems(playlistId: string, itemIds: string[], userId: string, tenantId: string): Promise<PlaylistResponse> {
    try {
      // Verify playlist belongs to the tenant
      const existingPlaylist = await playlistRepository.getPlaylistById(playlistId);
      if (existingPlaylist.tenantId !== tenantId) {
        return {
          success: false,
          message: 'You do not have permission to update this playlist'
        };
      }

      // Check if all items belong to this playlist
      const existingItemIds = existingPlaylist.items?.map(item => item.id) || [];
      const validItems = itemIds.every(id => existingItemIds.includes(id));
      
      if (!validItems) {
        return {
          success: false,
          message: 'One or more items do not belong to this playlist'
        };
      }

      await playlistRepository.reorderPlaylistItems(playlistId, itemIds);
      
      // Get updated playlist
      const updatedPlaylist = await playlistRepository.getPlaylistById(playlistId);
      
      return {
        success: true,
        message: 'Playlist items reordered successfully',
        playlist: this.mapPlaylistToShared(updatedPlaylist)
      };
    } catch (error) {
      console.error(`Error reordering playlist items for ${playlistId}:`, error);
      return {
        success: false,
        message: `Failed to reorder playlist items: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

export default new PlaylistService();