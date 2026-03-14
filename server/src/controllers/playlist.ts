/**
 * Playlist Controller
 *
 * Handles CRUD operations for playlists and playlist item reordering.
 */

import type { Context } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { playlistSchema, playlistReorderSchema } from '../validators/playlistValidator.ts';
import playlistRepository from '../repositories/playlist.ts';
import { checkTenantAccess } from '../middleware/tenantAuthorization.ts';
import { wsManager } from '../services/websocket.ts';

/**
 * Get all playlists for a tenant
 */
export async function getPlaylists(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const tenantId = c.req.param('tenantId');
  const playlists = await playlistRepository.getPlaylistsByTenant(tenantId);

  return c.json({
    success: true,
    playlists,
  });
}

/**
 * Get a specific playlist by ID
 */
export async function getPlaylistById(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const id = c.req.param('id');
  const playlist = await playlistRepository.getPlaylistById(id);

  if (!playlist) {
    return c.json({
      success: false,
      message: `Failed to get playlist: Playlist with ID ${id} not found`,
    }, 404);
  }

  // Verify the requesting user is a member of the tenant that owns this playlist
  const tenantId = playlist.tenantId;
  if (!tenantId) {
    return c.json({
      success: false,
      message: `Failed to get playlist: Playlist with ID ${id} not found`,
    }, 404);
  }

  const { hasAccess } = await checkTenantAccess(user.id, tenantId);
  if (!hasAccess) {
    return c.json({
      success: false,
      message: `Failed to get playlist: Playlist with ID ${id} not found`,
    }, 404);
  }

  return c.json({
    success: true,
    playlist,
  });
}

/**
 * Create a new playlist
 */
export async function createPlaylist(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const tenantId = c.req.param('tenantId');
  const body = c.get('sanitizedBody') || await c.req.json();
  const data = playlistSchema.parse(body);

  const created = await playlistRepository.createPlaylist({
    name: data.name,
    description: data.description,
    tenantId,
    createdById: user.id,
    items: data.items,
  });

  // Fetch the full playlist with items relation for the response
  const playlist = await playlistRepository.getPlaylistById(created.id);

  return c.json({
    success: true,
    playlist: playlist ?? { ...created, items: [] },
  }, 201);
}

/**
 * Update an existing playlist
 */
export async function updatePlaylist(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const id = c.req.param('id');
  const body = c.get('sanitizedBody') || await c.req.json();
  const data = playlistSchema.parse(body);

  const updated = await playlistRepository.updatePlaylist(id, {
    name: data.name,
    description: data.description,
    items: data.items,
  });

  if (!updated) {
    return c.json({ success: false, message: 'Playlist not found' }, 404);
  }

  // Re-fetch with items relation for the response
  const playlist = await playlistRepository.getPlaylistById(id);

  try { await wsManager.notifyDevicesByPlaylist(id); } catch { /* ignore */ }

  return c.json({
    success: true,
    playlist: playlist ?? { ...updated, items: [] },
  });
}

/**
 * Delete a playlist
 */
export async function deletePlaylist(c: Context<AppEnv>): Promise<Response> {
  const id = c.req.param('id');

  try { await wsManager.notifyDevicesByPlaylist(id); } catch { /* ignore */ }

  await playlistRepository.deletePlaylist(id);

  return c.json({
    success: true,
    message: 'Playlist deleted successfully',
  });
}

/**
 * Reorder playlist items
 */
export async function reorderPlaylistItems(c: Context<AppEnv>): Promise<Response> {
  const id = c.req.param('id');
  const body = c.get('sanitizedBody') || await c.req.json();
  const { itemIds } = playlistReorderSchema.parse(body);

  const items = itemIds.map((itemId: string, index: number) => ({
    id: itemId,
    position: index + 1,
  }));

  await playlistRepository.reorderPlaylistItems(items);

  try { await wsManager.notifyDevicesByPlaylist(id); } catch { /* ignore */ }

  return c.json({
    success: true,
    message: 'Playlist items reordered successfully',
  });
}
