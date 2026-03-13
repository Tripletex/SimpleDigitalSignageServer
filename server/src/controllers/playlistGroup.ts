/**
 * Playlist Group Controller
 *
 * Handles CRUD operations for playlist groups and their schedules.
 */

import type { Context } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { playlistGroupSchema, playlistScheduleSchema } from '../validators/playlistGroupValidator.ts';
import playlistGroupRepository from '../repositories/playlistGroup.ts';
import { checkTenantAccess } from '../middleware/tenantAuthorization.ts';

/**
 * Get all playlist groups for a tenant
 */
export async function getPlaylistGroups(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const tenantId = c.req.param('tenantId');
  const groups = await playlistGroupRepository.getPlaylistGroupsByTenant(tenantId);

  return c.json({
    success: true,
    playlistGroups: groups,
  });
}

/**
 * Get a specific playlist group by ID
 */
export async function getPlaylistGroupById(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const id = c.req.param('id');
  const group = await playlistGroupRepository.getPlaylistGroupById(id);

  if (!group) {
    return c.json({
      success: false,
      message: `Failed to get playlist group: Playlist group with ID ${id} not found`,
    }, 404);
  }

  // Verify the requesting user is a member of the tenant
  const tenantId = group.tenantId;
  if (!tenantId) {
    return c.json({
      success: false,
      message: `Failed to get playlist group: Playlist group with ID ${id} not found`,
    }, 404);
  }

  const { hasAccess } = await checkTenantAccess(user.id, tenantId);
  if (!hasAccess) {
    return c.json({
      success: false,
      message: `Failed to get playlist group: Playlist group with ID ${id} not found`,
    }, 404);
  }

  return c.json({
    success: true,
    playlistGroup: group,
  });
}

/**
 * Create a new playlist group
 */
export async function createPlaylistGroup(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const tenantId = c.req.param('tenantId');
  const body = c.get('sanitizedBody') || await c.req.json();
  const data = playlistGroupSchema.parse(body);

  const group = await playlistGroupRepository.createPlaylistGroup({
    name: data.name,
    description: data.description,
    tenantId,
    createdById: user.id,
    schedules: data.schedules?.map((s) => ({
      ...s,
      tenantId,
    })),
  });

  return c.json({
    success: true,
    playlistGroup: group,
  }, 201);
}

/**
 * Update an existing playlist group
 */
export async function updatePlaylistGroup(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const tenantId = c.req.param('tenantId');
  const id = c.req.param('id');
  const body = c.get('sanitizedBody') || await c.req.json();
  const data = playlistGroupSchema.parse(body);

  const group = await playlistGroupRepository.updatePlaylistGroup(id, {
    name: data.name,
    description: data.description,
    schedules: data.schedules?.map((s) => ({
      ...s,
      tenantId,
    })),
  });

  if (!group) {
    return c.json({ success: false, message: 'Playlist group not found' }, 404);
  }

  return c.json({
    success: true,
    playlistGroup: group,
  });
}

/**
 * Delete a playlist group
 */
export async function deletePlaylistGroup(c: Context<AppEnv>): Promise<Response> {
  const id = c.req.param('id');

  await playlistGroupRepository.deletePlaylistGroup(id);

  return c.json({
    success: true,
    message: 'Playlist group deleted successfully',
  });
}

/**
 * Add a schedule to a playlist group
 */
export async function addSchedule(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const tenantId = c.req.param('tenantId');
  const id = c.req.param('id');
  const body = c.get('sanitizedBody') || await c.req.json();
  const data = playlistScheduleSchema.parse(body);

  const schedule = await playlistGroupRepository.addPlaylistSchedule({
    playlistGroupId: id,
    playlistId: data.playlistId,
    tenantId,
    start: data.start,
    end: data.end,
    days: data.days,
  });

  return c.json({
    success: true,
    schedule,
  }, 201);
}

/**
 * Delete a schedule from a playlist group
 */
export async function deleteSchedule(c: Context<AppEnv>): Promise<Response> {
  const scheduleId = c.req.param('scheduleId');

  await playlistGroupRepository.deletePlaylistSchedule(scheduleId);

  return c.json({
    success: true,
    message: 'Schedule deleted successfully',
  });
}
