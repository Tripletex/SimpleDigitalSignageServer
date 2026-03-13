import { PlaylistGroup } from '../models/PlaylistGroup';
import { PlaylistSchedule } from '../models/PlaylistSchedule';
import { Playlist } from '../models/Playlist';
import { User } from '../models/User';
import { Tenant } from '../models/Tenant';
import { generateUUID } from '../utils/helpers';
import { PlaylistGroupData, PlaylistScheduleData } from '../../../shared/src/playlistData';
import { Op } from 'sequelize';

class PlaylistGroupRepository {
  /**
   * Get all playlist groups for a tenant
   */
  async getPlaylistGroupsByTenant(tenantId: string): Promise<PlaylistGroup[]> {
    return await PlaylistGroup.findAll({
      where: { tenantId },
      include: [
        {
          model: PlaylistSchedule,
          as: 'schedules',
          include: [
            {
              model: Playlist,
              attributes: ['id', 'name']
            }
          ]
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
   * Get a playlist group by ID
   */
  async getPlaylistGroupById(id: string): Promise<PlaylistGroup> {
    const playlistGroup = await PlaylistGroup.findByPk(id, {
      include: [
        {
          model: PlaylistSchedule,
          as: 'schedules',
          include: [
            {
              model: Playlist,
              attributes: ['id', 'name']
            }
          ]
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

    if (!playlistGroup) {
      throw new Error(`Playlist group with ID ${id} not found`);
    }

    return playlistGroup;
  }

  /**
   * Create a new playlist group
   */
  async createPlaylistGroup(groupData: PlaylistGroupData, userId: string, tenantId: string): Promise<PlaylistGroup> {
    // Start a transaction
    const transaction = await PlaylistGroup.sequelize!.transaction();

    try {
      // Create the playlist group
      const playlistGroup = await PlaylistGroup.create({
        id: generateUUID(),
        name: groupData.name,
        description: groupData.description,
        tenantId: tenantId,
        createdById: userId,
      }, { transaction });

      // Add schedules if provided
      if (groupData.schedules && groupData.schedules.length > 0) {
        const schedulesWithGroupId = groupData.schedules.map(schedule => ({
          id: generateUUID(),
          playlistGroupId: playlistGroup.id,
          playlistId: schedule.playlistId,
          start: schedule.start,
          end: schedule.end,
          days: schedule.days
        }));

        await PlaylistSchedule.bulkCreate(schedulesWithGroupId, { transaction });
      }

      // Commit transaction
      await transaction.commit();

      // Fetch the complete playlist group with schedules
      return await this.getPlaylistGroupById(playlistGroup.id);
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Update an existing playlist group
   */
  async updatePlaylistGroup(id: string, groupData: PlaylistGroupData): Promise<PlaylistGroup> {
    // Start a transaction
    const transaction = await PlaylistGroup.sequelize!.transaction();

    try {
      // Get existing playlist group
      const playlistGroup = await PlaylistGroup.findByPk(id);
      if (!playlistGroup) {
        throw new Error(`Playlist group with ID ${id} not found`);
      }

      // Update playlist group properties
      playlistGroup.name = groupData.name;
      if (groupData.description !== undefined) {
        playlistGroup.description = groupData.description;
      }
      await playlistGroup.save({ transaction });

      // Handle schedules if provided
      if (groupData.schedules) {
        // Delete existing schedules
        await PlaylistSchedule.destroy({
          where: { playlistGroupId: id },
          transaction
        });

        // Create new schedules
        if (groupData.schedules.length > 0) {
          const schedulesWithGroupId = groupData.schedules.map(schedule => ({
            id: generateUUID(),
            playlistGroupId: id,
            playlistId: schedule.playlistId,
            start: schedule.start,
            end: schedule.end,
            days: schedule.days
          }));

          await PlaylistSchedule.bulkCreate(schedulesWithGroupId, { transaction });
        }
      }

      // Commit transaction
      await transaction.commit();

      // Fetch the updated playlist group with schedules
      return await this.getPlaylistGroupById(id);
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Delete a playlist group
   */
  async deletePlaylistGroup(id: string): Promise<boolean> {
    // Start a transaction
    const transaction = await PlaylistGroup.sequelize!.transaction();

    try {
      // Delete related schedules first
      await PlaylistSchedule.destroy({
        where: { playlistGroupId: id },
        transaction
      });

      // Delete the playlist group
      const deleted = await PlaylistGroup.destroy({
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
   * Add a schedule to a playlist group
   */
  async addPlaylistSchedule(playlistGroupId: string, scheduleData: PlaylistScheduleData): Promise<PlaylistSchedule> {
    // Get the playlist group to ensure it exists
    const playlistGroup = await PlaylistGroup.findByPk(playlistGroupId);
    if (!playlistGroup) {
      throw new Error(`Playlist group with ID ${playlistGroupId} not found`);
    }

    // Verify that the playlist exists
    const playlist = await Playlist.findByPk(scheduleData.playlistId);
    if (!playlist) {
      throw new Error(`Playlist with ID ${scheduleData.playlistId} not found`);
    }

    // Create the new schedule
    const schedule = await PlaylistSchedule.create({
      id: generateUUID(),
      playlistGroupId,
      playlistId: scheduleData.playlistId,
      start: scheduleData.start,
      end: scheduleData.end,
      days: scheduleData.days
    });

    return schedule;
  }

  /**
   * Update a playlist schedule
   */
  async updatePlaylistSchedule(scheduleId: string, scheduleData: PlaylistScheduleData): Promise<PlaylistSchedule> {
    const schedule = await PlaylistSchedule.findByPk(scheduleId);
    if (!schedule) {
      throw new Error(`Playlist schedule with ID ${scheduleId} not found`);
    }

    // Update schedule properties
    if (scheduleData.playlistId) {
      // Verify that the playlist exists
      const playlist = await Playlist.findByPk(scheduleData.playlistId);
      if (!playlist) {
        throw new Error(`Playlist with ID ${scheduleData.playlistId} not found`);
      }
      schedule.playlistId = scheduleData.playlistId;
    }
    
    if (scheduleData.start) schedule.start = scheduleData.start;
    if (scheduleData.end) schedule.end = scheduleData.end;
    if (scheduleData.days) schedule.days = scheduleData.days;

    await schedule.save();
    return schedule;
  }

  /**
   * Delete a playlist schedule
   */
  async deletePlaylistSchedule(scheduleId: string): Promise<boolean> {
    const deleted = await PlaylistSchedule.destroy({
      where: { id: scheduleId }
    });

    return deleted > 0;
  }
}

export default new PlaylistGroupRepository();