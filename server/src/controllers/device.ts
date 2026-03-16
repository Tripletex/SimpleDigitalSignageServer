/**
 * Device Controller
 *
 * Handles device registration, management, claiming, and campaign assignment.
 */

import type { Context } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { deviceRegistrationRequestSchema, deviceClaimSchema, deviceCampaignAssignmentSchema } from '../validators/deviceRegistrationValidator.ts';
import { deviceDataSchema } from '../validators/deviceDataValidator.ts';
import deviceRepository from '../repositories/device.ts';
import deviceRegistrationRepository from '../repositories/deviceRegistration.ts';
import deviceApiKeyRepository from '../repositories/deviceApiKey.ts';
import tenantRepository from '../repositories/tenant.ts';
import playlistGroupRepository from '../repositories/playlistGroup.ts';
import playlistRepository from '../repositories/playlist.ts';
import { wsManager } from '../services/websocket.ts';
import tenantSecretRepository from '../repositories/tenantSecret.ts';

/**
 * Get the set of tenant IDs accessible to the authenticated caller.
 */
async function getAccessibleTenantIds(c: Context<AppEnv>): Promise<Set<string>> {
  const device = c.get('device');
  if (device?.tenantId) {
    return new Set([device.tenantId]);
  }

  const user = c.get('user');
  if (user) {
    const memberships = await tenantRepository.getUserTenants(user.id);
    const tenantIds: string[] = [];
    for (const m of memberships) {
      if (m.tenant) {
        tenantIds.push(m.tenant.id);
      }
    }
    return new Set(tenantIds);
  }

  return new Set();
}

/**
 * Register a new device and generate a device ID
 */
export async function registerDevice(c: Context<AppEnv>): Promise<Response> {
  const body = c.get('sanitizedBody') || await c.req.json();
  const data = deviceRegistrationRequestSchema.parse(body);

  console.log('[REGISTER] Received registration request');
  console.log('[REGISTER] Public key length:', data.publicKey.length);

  // Create device and registration records
  const { device, registration } = await deviceRegistrationRepository.registerDevice({
    deviceType: data.deviceType,
    hardwareId: data.hardwareId,
    publicKey: data.publicKey,
  });

  console.log('[REGISTER] Created device record:', device.id);

  // Generate an API key for the device
  const apiKeyResult = await deviceApiKeyRepository.generateApiKey(device.id);
  console.log('[REGISTER] API key generated successfully');

  return c.json({
    id: device.id,
    apiKey: apiKeyResult.plainKey,
    registrationTime: registration.registrationTime,
  }, 201);
}

/**
 * Update device last seen status (ping)
 */
export async function pingDevice(c: Context<AppEnv>): Promise<Response> {
  const body = c.get('sanitizedBody') || await c.req.json();
  const deviceData = deviceDataSchema.parse(body);

  // If we have device from API key authentication, verify that it matches
  const device = c.get('device');
  if (device && device.id !== deviceData.id) {
    return c.json({
      message: 'Device ID in request does not match authenticated device',
    }, 403);
  }

  const result = await deviceRepository.updateLastSeen({
    id: deviceData.id,
    name: deviceData.name,
    networks: deviceData.networks?.map((n) => ({
      name: n.name,
      ipAddresses: n.ipAddress,
    })) ?? [],
    displays: deviceData.displays,
  });

  return c.json(result);
}

/**
 * Get all devices with ping data, scoped to the caller's accessible tenants
 */
export async function getAllDevices(c: Context<AppEnv>): Promise<Response> {
  const accessibleTenantIds = await getAccessibleTenantIds(c);
  const onlyClaimed = c.req.query('onlyClaimed') !== 'false';

  const devices = onlyClaimed
    ? await deviceRepository.getClaimedDevices()
    : await deviceRepository.getDevices();

  // Filter to only devices belonging to the caller's accessible tenants
  const scopedDevices = devices.filter((d) =>
    d.tenantId && accessibleTenantIds.has(d.tenantId)
  );

  const devicesWithRegistrations = scopedDevices.map((d) => {
    const registration = d.registrations?.[0];
    return {
      deviceData: {
        id: d.id,
        name: d.name,
        displayName: d.displayName,
        tenantId: d.tenantId,
        displayCount: d.displayCount,
        displays: d.displays,
        displayCampaigns: (d.displayCampaigns ?? []).map((dc) => ({
          displayName: dc.displayName,
          hardwareId: dc.hardwareId,
          campaignId: dc.campaignId,
        })),
      },
      lastSeen: registration?.lastSeen || new Date(),
      registrationTime: registration?.registrationTime || new Date(),
    };
  });

  return c.json(devicesWithRegistrations);
}

/**
 * Get a specific device by ID, with tenant access verification
 */
export async function getDeviceById(c: Context<AppEnv>): Promise<Response> {
  const id = c.req.param('id');
  const device = await deviceRepository.getDeviceById(id);

  if (!device) {
    return c.json({ success: false, message: 'Device not found' }, 404);
  }

  // Verify the caller has access to this device's tenant
  const accessibleTenantIds = await getAccessibleTenantIds(c);
  if (!device.tenantId || !accessibleTenantIds.has(device.tenantId)) {
    return c.json({ success: false, message: 'Device not found' }, 404);
  }

  const registration = device.registrations?.[0];
  return c.json({
    deviceData: {
      id: device.id,
      name: device.name,
      displayName: device.displayName,
      tenantId: device.tenantId,
      displayCount: device.displayCount,
      displays: device.displays,
      displayCampaigns: (device.displayCampaigns ?? []).map((dc) => ({
        displayName: dc.displayName,
        hardwareId: dc.hardwareId,
        campaignId: dc.campaignId,
      })),
    },
    lastSeen: registration?.lastSeen || new Date(),
    registrationTime: registration?.registrationTime || new Date(),
  });
}

/**
 * Get all registered devices, scoped to accessible tenants
 */
export async function getAllRegisteredDevices(c: Context<AppEnv>): Promise<Response> {
  const accessibleTenantIds = await getAccessibleTenantIds(c);
  const devices = await deviceRegistrationRepository.getAllRegisteredDevices();

  const scopedDevices = devices.filter((registration) =>
    registration.device?.tenantId && accessibleTenantIds.has(registration.device.tenantId)
  );

  return c.json(scopedDevices);
}

/**
 * Get devices for a specific tenant
 */
export async function getTenantDevices(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const tenantId = c.req.param('tenantId');
  const devices = await deviceRepository.getDevicesByTenant(tenantId);

  const devicesWithRegistrations = devices.map((d) => {
    const registration = d.registrations?.[0];
    return {
      deviceData: {
        id: d.id,
        name: d.name,
        displayName: d.displayName,
        tenantId: d.tenantId,
        displayCount: d.displayCount,
        displays: d.displays,
        displayCampaigns: (d.displayCampaigns ?? []).map((dc) => ({
          displayName: dc.displayName,
          hardwareId: dc.hardwareId,
          campaignId: dc.campaignId,
        })),
      },
      lastSeen: registration?.lastSeen || new Date(),
      registrationTime: registration?.registrationTime || new Date(),
    };
  });

  return c.json({
    success: true,
    devices: devicesWithRegistrations,
  });
}

/**
 * Claim a device for a tenant
 */
export async function claimDevice(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const tenantId = c.req.param('tenantId');
  const body = c.get('sanitizedBody') || await c.req.json();
  const claimData = deviceClaimSchema.parse(body);

  try {
    const device = await deviceRepository.claimDevice(
      claimData.deviceId,
      tenantId,
      user.id,
      claimData.displayName,
    );

    if (device) {
      return c.json({ success: true, device });
    }

    console.error(`[CLAIM] Device ${claimData.deviceId} not found or claim returned no result`);
    return c.json({ success: false, message: 'Device not found' }, 404);
  } catch (error) {
    console.error('[CLAIM] Error claiming device:', error instanceof Error ? error.message : error);
    return c.json({ success: false, message: 'Failed to claim device' }, 400);
  }
}

/**
 * Release a device from a tenant
 */
export async function releaseDevice(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const tenantId = c.req.param('tenantId');
  const deviceId = c.req.param('deviceId');
  console.log(`[RELEASE DEVICE] Releasing device ${deviceId} from tenant ${tenantId}`);

  // First check if device exists and belongs to this tenant
  const device = await deviceRepository.getDeviceById(deviceId);
  if (!device) {
    return c.json({
      success: false,
      message: 'Device not found',
    }, 404);
  }

  if (device.tenantId !== tenantId) {
    return c.json({
      success: false,
      message: `Device does not belong to tenant ${tenantId}`,
    }, 400);
  }

  const result = await deviceRepository.releaseDevice(deviceId);
  console.log(`[RELEASE DEVICE] Release result:`, result);

  if (result) {
    try {
      wsManager.updateDeviceCampaigns(deviceId, []);
      wsManager.notifyDevice(deviceId, { type: 'device_released', timestamp: new Date().toISOString() });
    } catch { /* ignore */ }
    return c.json({ success: true, message: 'Device released successfully' });
  }

  return c.json({ success: false, message: 'Failed to release device' }, 400);
}

/**
 * Assign a campaign to a specific display on a device
 */
export async function assignDisplayCampaign(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const tenantId = c.req.param('tenantId');
  const deviceId = c.req.param('deviceId');
  const displayName = decodeURIComponent(c.req.param('displayName'));
  const body = c.get('sanitizedBody') || await c.req.json();
  const assignmentData = deviceCampaignAssignmentSchema.parse(body);

  // Verify device belongs to this tenant
  const device = await deviceRepository.getDeviceById(deviceId);
  if (!device || device.tenantId !== tenantId) {
    return c.json({ success: false, message: 'Device not found in this tenant' }, 404);
  }

  // Look up hardware ID from the device's reported displays
  const displayInfo = (device.displays as Array<{ name: string; hardwareId?: string }> | null)
    ?.find((d) => d.name === displayName);
  const hardwareId = displayInfo?.hardwareId;

  const result = await deviceRepository.assignDisplayCampaign(
    deviceId,
    displayName,
    assignmentData.campaignId,
    tenantId,
    hardwareId,
  );

  try {
    wsManager.updateDeviceCampaigns(deviceId, device.displayCampaigns ?? []);
    wsManager.notifyDevice(deviceId, { type: 'campaign_changed', timestamp: new Date().toISOString() });
  } catch { /* ignore */ }

  return c.json({ success: true, result });
}

/**
 * Clear all display campaign assignments for a device
 */
export async function clearDisplayCampaigns(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const tenantId = c.req.param('tenantId');
  const deviceId = c.req.param('deviceId');

  const device = await deviceRepository.getDeviceById(deviceId);
  if (!device || device.tenantId !== tenantId) {
    return c.json({ success: false, message: 'Device not found in this tenant' }, 404);
  }

  const count = await deviceRepository.clearDisplayCampaigns(deviceId);

  try {
    wsManager.updateDeviceCampaigns(deviceId, []);
    wsManager.notifyDevice(deviceId, { type: 'campaign_changed', timestamp: new Date().toISOString() });
  } catch { /* ignore */ }

  return c.json({ success: true, message: `Cleared ${count} campaign assignment(s)` });
}

/**
 * Resolve secret references in playlist item headers.
 * Replaces { secretId: "uuid" } with the decrypted value,
 * but only if the item's URL domain matches the secret's domain.
 */
async function resolveItemHeaders(
  item: { data?: Record<string, unknown> },
  tenantId: string,
): Promise<Record<string, string> | undefined> {
  const headers = item.data?.headers as Record<string, string | { secretId: string }> | undefined;
  if (!headers) return undefined;

  let itemDomain: string | undefined;
  try {
    const location = item.data?.location as string | undefined;
    if (location) itemDomain = new URL(location).hostname;
  } catch { /* ignore invalid URLs */ }

  const resolved: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      resolved[name] = value;
    } else if (value && typeof value === 'object' && 'secretId' in value) {
      const secret = await tenantSecretRepository.getSecretById(value.secretId, tenantId);
      if (!secret) {
        console.warn(`[CONTENT] Secret ${value.secretId} not found, skipping header ${name}`);
        continue;
      }

      // Enforce domain match
      if (secret.domain && itemDomain && secret.domain !== itemDomain) {
        console.warn(`[CONTENT] Secret "${secret.name}" domain ${secret.domain} does not match item domain ${itemDomain}, skipping`);
        continue;
      }

      const decrypted = await tenantSecretRepository.getDecryptedValue(value.secretId, tenantId);
      if (decrypted) {
        resolved[name] = decrypted;
      }
    }
  }

  return Object.keys(resolved).length > 0 ? resolved : undefined;
}

/**
 * Resolve a campaign (playlist group) to its full content with schedules.
 * Secret references in headers are decrypted and domain-validated.
 */
async function resolveCampaign(campaignId: string, tenantId: string) {
  const playlistGroup = await playlistGroupRepository.getPlaylistGroupById(campaignId);
  if (!playlistGroup) return null;

  const schedules = await Promise.all(
    (playlistGroup.schedules ?? []).map(async (schedule) => {
      const playlist = await playlistRepository.getPlaylistById(schedule.playlistId);
      return {
        id: schedule.id,
        start: schedule.start,
        end: schedule.end,
        days: schedule.days,
        playlist: playlist
          ? {
            id: playlist.id,
            name: playlist.name,
            items: await Promise.all((playlist.items ?? []).map(async (item) => ({
              id: item.id,
              type: item.type,
              data: {
                ...item.data as Record<string, unknown>,
                headers: await resolveItemHeaders(
                  { data: item.data as Record<string, unknown> },
                  tenantId,
                ),
              },
              duration: item.duration,
              position: item.position,
            }))),
          }
          : null,
      };
    }),
  );

  return {
    id: playlistGroup.id,
    name: playlistGroup.name,
    schedules,
  };
}

/**
 * Get the assigned campaign content for a device — returns per-display data.
 */
export async function getDeviceContent(c: Context<AppEnv>): Promise<Response> {
  const device = c.get('device');
  const fullDevice = await deviceRepository.getDeviceById(device.id);

  if (!fullDevice) {
    return c.json({ success: false, message: 'Device not found' }, 404);
  }

  if (!fullDevice.tenantId) {
    return c.json({ success: false, message: 'Device not claimed' }, 404);
  }

  const displayCampaigns = fullDevice.displayCampaigns ?? [];

  if (displayCampaigns.length === 0) {
    return c.json({ success: true, displays: {} });
  }

  // Resolve all unique campaigns
  const uniqueCampaignIds = [...new Set(displayCampaigns.map((dc) => dc.campaignId))];
  const resolvedCampaigns = new Map<string, Awaited<ReturnType<typeof resolveCampaign>>>();
  await Promise.all(
    uniqueCampaignIds.map(async (id) => {
      resolvedCampaigns.set(id, await resolveCampaign(id, fullDevice.tenantId!));
    }),
  );

  // Build per-display response, keyed by hardwareId when available, else displayName
  const displays: Record<string, {
    campaign: Awaited<ReturnType<typeof resolveCampaign>>;
    displayName: string;
    hardwareId?: string;
  }> = {};
  for (const dc of displayCampaigns) {
    const key = dc.hardwareId || dc.displayName;
    displays[key] = {
      campaign: resolvedCampaigns.get(dc.campaignId) ?? null,
      displayName: dc.displayName,
      hardwareId: dc.hardwareId ?? undefined,
    };
  }

  return c.json({ success: true, displays });
}
