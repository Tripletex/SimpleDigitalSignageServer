import { eq, asc, sql } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { playlists, playlistItems } from '../db/schema/index.ts';
import { uuidv7 } from '../utils/helpers.ts';

function validateUrl(url: string): void {
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
}

const playlistRepository = {
  async getPlaylistsByTenant(tenantId: string) {
    return db.query.playlists.findMany({
      where: eq(playlists.tenantId, tenantId),
      with: {
        items: {
          orderBy: [asc(playlistItems.position)],
        },
        createdBy: true,
      },
    });
  },

  async getPlaylistById(id: string) {
    return db.query.playlists.findFirst({
      where: eq(playlists.id, id),
      with: {
        items: {
          orderBy: [asc(playlistItems.position)],
        },
        createdBy: true,
        tenant: true,
      },
    });
  },

  async createPlaylist(data: {
    name: string;
    description?: string;
    tenantId: string;
    createdById: string;
    items?: Array<{
      type: string;
      url?: { location: string };
      duration: number;
    }>;
  }) {
    return db.transaction(async (tx) => {
      const [playlist] = await tx.insert(playlists).values({
        id: uuidv7(),
        name: data.name,
        description: data.description,
        tenantId: data.tenantId,
        createdById: data.createdById,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      if (data.items && data.items.length > 0) {
        const itemValues = data.items.map((item, index) => {
          if (item.type === 'url' && item.url?.location) {
            validateUrl(item.url.location);
          }
          return {
            id: uuidv7(),
            playlistId: playlist.id,
            tenantId: data.tenantId,
            position: index + 1,
            type: item.type,
            url: item.url ?? null,
            duration: item.duration,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        });

        await tx.insert(playlistItems).values(itemValues);
      }

      return playlist;
    });
  },

  async updatePlaylist(id: string, data: {
    name?: string;
    description?: string;
    items?: Array<{
      type: string;
      url?: { location: string };
      duration: number;
    }>;
  }) {
    return db.transaction(async (tx) => {
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;

      const [playlist] = await tx.update(playlists)
        .set(updateData)
        .where(eq(playlists.id, id))
        .returning();

      if (data.items !== undefined) {
        await tx.delete(playlistItems)
          .where(eq(playlistItems.playlistId, id));

        if (data.items.length > 0) {
          const itemValues = data.items.map((item, index) => {
            if (item.type === 'url' && item.url?.location) {
              validateUrl(item.url.location);
            }
            return {
              id: uuidv7(),
              playlistId: id,
              tenantId: playlist.tenantId,
              position: index + 1,
              type: item.type,
              url: item.url ?? null,
              duration: item.duration,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          });

          await tx.insert(playlistItems).values(itemValues);
        }
      }

      return playlist;
    });
  },

  async deletePlaylist(id: string) {
    return db.transaction(async (tx) => {
      await tx.delete(playlistItems)
        .where(eq(playlistItems.playlistId, id));
      await tx.delete(playlists)
        .where(eq(playlists.id, id));
    });
  },

  async addPlaylistItem(
    playlistId: string,
    tenantId: string,
    data: {
      type: string;
      url?: { location: string };
      duration: number;
    },
  ) {
    // Find max position
    const existing = await db.select({ maxPos: sql<number>`COALESCE(MAX(${playlistItems.position}), 0)` })
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, playlistId));

    const nextPosition = (existing[0]?.maxPos ?? 0) + 1;

    const result = await db.insert(playlistItems).values({
      id: uuidv7(),
      playlistId,
      tenantId,
      position: nextPosition,
      type: data.type,
      url: data.url ?? null,
      duration: data.duration,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  },

  async updatePlaylistItem(id: string, data: Partial<{
    type: string;
    url: { location: string };
    duration: number;
    position: number;
  }>) {
    if (data.type === 'url' && data.url?.location) {
      validateUrl(data.url.location);
    }

    const result = await db.update(playlistItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(playlistItems.id, id))
      .returning();
    return result[0];
  },

  async deletePlaylistItem(id: string) {
    return db.delete(playlistItems)
      .where(eq(playlistItems.id, id));
  },

  async reorderPlaylistItems(items: Array<{ id: string; position: number }>) {
    return db.transaction(async (tx) => {
      for (const item of items) {
        await tx.update(playlistItems)
          .set({ position: item.position, updatedAt: new Date() })
          .where(eq(playlistItems.id, item.id));
      }
    });
  },
};

export default playlistRepository;
