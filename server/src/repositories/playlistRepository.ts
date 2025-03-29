import { Playlist } from '../models/Playlist';
import { PlaylistItem } from '../models/PlaylistItem';
import { User } from '../models/User';
import { Tenant } from '../models/Tenant';
import { generateUUID } from '../utils/helpers';
import { PlaylistData, PlaylistItemData } from '../../../shared/src/playlistData';
import { Op } from 'sequelize';

class PlaylistRepository {
  /**
   * Get all playlists for a tenant
   */
  async getPlaylistsByTenant(tenantId: string): Promise<Playlist[]> {
    return await Playlist.findAll({
      where: { tenantId },
      include: [
        {
          model: PlaylistItem,
          as: 'items',
          order: [['position', 'ASC']]
        },
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'displayName', 'email']
        }
      ],
      order: [['updatedAt', 'DESC']]
    });
  }

  /**
   * Get a playlist by ID
   */
  async getPlaylistById(id: string): Promise<Playlist> {
    const playlist = await Playlist.findByPk(id, {
      include: [
        {
          model: PlaylistItem,
          as: 'items',
          order: [['position', 'ASC']]
        },
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'displayName', 'email']
        },
        {
          model: Tenant
        }
      ]
    });

    if (!playlist) {
      throw new Error(`Playlist with ID ${id} not found`);
    }

    return playlist;
  }

  /**
   * Create a new playlist
   */
  async createPlaylist(playlistData: PlaylistData, userId: string, tenantId: string): Promise<Playlist> {
    // Start a transaction
    const transaction = await Playlist.sequelize!.transaction();

    try {
      // Create the playlist
      const playlist = await Playlist.create({
        id: generateUUID(),
        name: playlistData.name,
        description: playlistData.description,
        tenantId: tenantId,
        createdById: userId,
      }, { transaction });

      // Add items if provided
      if (playlistData.items && playlistData.items.length > 0) {
        // Create items with positions
        const itemsWithPositions = playlistData.items.map((item, index) => ({
          id: generateUUID(),
          playlistId: playlist.id,
          position: index,
          type: item.type,
          url: item.url,
          duration: item.duration
        }));

        await PlaylistItem.bulkCreate(itemsWithPositions, { transaction });
      }

      // Commit transaction
      await transaction.commit();

      // Fetch the complete playlist with items
      return await this.getPlaylistById(playlist.id);
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Update an existing playlist
   */
  async updatePlaylist(id: string, playlistData: PlaylistData): Promise<Playlist> {
    // Start a transaction
    const transaction = await Playlist.sequelize!.transaction();

    try {
      // Get existing playlist
      const playlist = await Playlist.findByPk(id);
      if (!playlist) {
        throw new Error(`Playlist with ID ${id} not found`);
      }

      // Update playlist properties
      playlist.name = playlistData.name;
      if (playlistData.description !== undefined) {
        playlist.description = playlistData.description;
      }
      await playlist.save({ transaction });

      // Handle items if provided
      if (playlistData.items) {
        // Delete existing items
        await PlaylistItem.destroy({
          where: { playlistId: id },
          transaction
        });

        // Create new items with positions
        if (playlistData.items.length > 0) {
          const itemsWithPositions = playlistData.items.map((item, index) => ({
            id: generateUUID(),
            playlistId: id,
            position: index,
            type: item.type,
            url: item.url,
            duration: item.duration
          }));

          await PlaylistItem.bulkCreate(itemsWithPositions, { transaction });
        }
      }

      // Commit transaction
      await transaction.commit();

      // Fetch the updated playlist with items
      return await this.getPlaylistById(id);
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Delete a playlist
   */
  async deletePlaylist(id: string): Promise<boolean> {
    // Start a transaction
    const transaction = await Playlist.sequelize!.transaction();

    try {
      // Delete related items first
      await PlaylistItem.destroy({
        where: { playlistId: id },
        transaction
      });

      // Delete the playlist
      const deleted = await Playlist.destroy({
        where: { id },
        transaction
      });

      // Commit transaction
      await transaction.commit();

      return deleted > 0;
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Add an item to a playlist
   */
  async addPlaylistItem(playlistId: string, itemData: PlaylistItemData): Promise<PlaylistItem> {
    // Get the playlist to ensure it exists
    const playlist = await Playlist.findByPk(playlistId);
    if (!playlist) {
      throw new Error(`Playlist with ID ${playlistId} not found`);
    }

    // Get current max position
    const maxPositionItem = await PlaylistItem.findOne({
      where: { playlistId },
      order: [['position', 'DESC']]
    });

    const position = maxPositionItem ? maxPositionItem.position + 1 : 0;

    // Create the new item
    const item = await PlaylistItem.create({
      id: generateUUID(),
      playlistId,
      position,
      type: itemData.type,
      url: itemData.url,
      duration: itemData.duration
    });

    return item;
  }

  /**
   * Update a playlist item
   */
  async updatePlaylistItem(itemId: string, itemData: PlaylistItemData): Promise<PlaylistItem> {
    const item = await PlaylistItem.findByPk(itemId);
    if (!item) {
      throw new Error(`Playlist item with ID ${itemId} not found`);
    }

    // Update item properties
    if (itemData.type) item.type = itemData.type;
    if (itemData.url) item.url = itemData.url;
    if (itemData.duration) item.duration = itemData.duration;
    if (itemData.position !== undefined) item.position = itemData.position;

    await item.save();
    return item;
  }

  /**
   * Delete a playlist item
   */
  async deletePlaylistItem(itemId: string): Promise<boolean> {
    const deleted = await PlaylistItem.destroy({
      where: { id: itemId }
    });

    return deleted > 0;
  }

  /**
   * Reorder playlist items
   */
  async reorderPlaylistItems(playlistId: string, itemIds: string[]): Promise<boolean> {
    // Start a transaction
    const transaction = await Playlist.sequelize!.transaction();

    try {
      // Update position for each item
      for (let i = 0; i < itemIds.length; i++) {
        await PlaylistItem.update(
          { position: i },
          { 
            where: { 
              id: itemIds[i],
              playlistId 
            },
            transaction
          }
        );
      }

      // Commit transaction
      await transaction.commit();
      return true;
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }
  }
}

export default new PlaylistRepository();