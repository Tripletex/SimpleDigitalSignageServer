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
        campaignId: d.campaignId,
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
      campaignId: device.campaignId,
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
        campaignId: d.campaignId,
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

  const device = await deviceRepository.claimDevice(
    claimData.deviceId,
    tenantId,
    user.id,
    claimData.displayName,
  );

  if (device) {
    return c.json({ success: true, device });
  }

  return c.json({ success: false, message: 'Failed to claim device' }, 400);
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
    return c.json({ success: true, message: 'Device released successfully' });
  }

  return c.json({ success: false, message: 'Failed to release device' }, 400);
}

/**
 * Assign a campaign to a device
 */
export async function assignCampaign(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const tenantId = c.req.param('tenantId');
  const deviceId = c.req.param('deviceId');
  const body = c.get('sanitizedBody') || await c.req.json();
  const assignmentData = deviceCampaignAssignmentSchema.parse(body);

  if (deviceId !== assignmentData.deviceId) {
    return c.json({
      success: false,
      message: 'Device ID in path does not match device ID in request body',
    }, 400);
  }

  // Verify device belongs to this tenant
  const device = await deviceRepository.getDeviceById(deviceId);
  if (!device || device.tenantId !== tenantId) {
    return c.json({ success: false, message: 'Device not found in this tenant' }, 404);
  }

  const result = await deviceRepository.assignCampaign(
    deviceId,
    assignmentData.campaignId ?? '',
  );

  if (result) {
    return c.json({ success: true, device: result });
  }

  return c.json({ success: false, message: 'Failed to assign campaign' }, 400);
}
