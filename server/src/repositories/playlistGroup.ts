import { eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { playlistGroups, playlistSchedules } from '../db/schema/index.ts';
import { uuidv7 } from '../utils/helpers.ts';

const playlistGroupRepository = {
  async getPlaylistGroupsByTenant(tenantId: string) {
    return db.query.playlistGroups.findMany({
      where: eq(playlistGroups.tenantId, tenantId),
      with: {
        schedules: {
          with: {
            playlist: true,
          },
        },
        createdBy: true,
      },
    });
  },

  async getPlaylistGroupById(id: string) {
    return db.query.playlistGroups.findFirst({
      where: eq(playlistGroups.id, id),
      with: {
        schedules: {
          with: {
            playlist: true,
          },
        },
        createdBy: true,
      },
    });
  },

  async createPlaylistGroup(data: {
    name: string;
    description?: string;
    tenantId: string;
    createdById: string;
    schedules?: Array<{
      playlistId: string;
      tenantId: string;
      start: string;
      end: string;
      days: string[];
    }>;
  }) {
    return db.transaction(async (tx) => {
      const [group] = await tx.insert(playlistGroups).values({
        id: uuidv7(),
        name: data.name,
        description: data.description,
        tenantId: data.tenantId,
        createdById: data.createdById,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      if (data.schedules && data.schedules.length > 0) {
        await tx.insert(playlistSchedules).values(
          data.schedules.map((s) => ({
            id: uuidv7(),
            playlistGroupId: group.id,
            playlistId: s.playlistId,
            tenantId: s.tenantId,
            start: s.start,
            end: s.end,
            days: s.days,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );
      }

      return group;
    });
  },

  async updatePlaylistGroup(id: string, data: {
    name?: string;
    description?: string;
    schedules?: Array<{
      playlistId: string;
      tenantId: string;
      start: string;
      end: string;
      days: string[];
    }>;
  }) {
    return db.transaction(async (tx) => {
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;

      const [group] = await tx.update(playlistGroups)
        .set(updateData)
        .where(eq(playlistGroups.id, id))
        .returning();

      if (data.schedules !== undefined) {
        await tx.delete(playlistSchedules)
          .where(eq(playlistSchedules.playlistGroupId, id));

        if (data.schedules.length > 0) {
          await tx.insert(playlistSchedules).values(
            data.schedules.map((s) => ({
              id: uuidv7(),
              playlistGroupId: id,
              playlistId: s.playlistId,
              tenantId: s.tenantId,
              start: s.start,
              end: s.end,
              days: s.days,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
          );
        }
      }

      return group;
    });
  },

  async deletePlaylistGroup(id: string) {
    return db.transaction(async (tx) => {
      await tx.delete(playlistSchedules)
        .where(eq(playlistSchedules.playlistGroupId, id));
      await tx.delete(playlistGroups)
        .where(eq(playlistGroups.id, id));
    });
  },

  async addPlaylistSchedule(data: {
    playlistGroupId: string;
    playlistId: string;
    tenantId: string;
    start: string;
    end: string;
    days: string[];
  }) {
    const result = await db.insert(playlistSchedules).values({
      id: uuidv7(),
      playlistGroupId: data.playlistGroupId,
      playlistId: data.playlistId,
      tenantId: data.tenantId,
      start: data.start,
      end: data.end,
      days: data.days,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  },

  async updatePlaylistSchedule(id: string, data: Partial<{
    playlistId: string;
    start: string;
    end: string;
    days: string[];
  }>) {
    const result = await db.update(playlistSchedules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(playlistSchedules.id, id))
      .returning();
    return result[0];
  },

  async deletePlaylistSchedule(id: string) {
    return db.delete(playlistSchedules)
      .where(eq(playlistSchedules.id, id));
  },
};

export default playlistGroupRepository;
