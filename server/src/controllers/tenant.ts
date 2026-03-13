/**
 * Tenant Controller
 *
 * Handles tenant CRUD, invitations, member management, and personal tenant creation.
 */

import type { Context } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { env } from '../config/env.ts';
import {
  tenantCreateSchema,
  tenantUpdateSchema,
  tenantInviteSchema,
  tenantMemberUpdateSchema,
} from '../validators/tenantValidator.ts';
import tenantService from '../services/tenant.ts';
import tenantRepository from '../repositories/tenant.ts';
import userService from '../services/user.ts';
import emailVerificationService from '../services/emailVerification.ts';

/**
 * Get all tenants for the current user
 */
export async function getUserTenants(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  console.log(`Fetching tenants for user ${user.id}`);

  // Ensure the user has a personal tenant
  const dbUser = await userService.getUserById(user.id);
  if (!dbUser) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  try {
    await tenantService.createPersonalTenantIfNeeded(user.id, dbUser.email);
  } catch (error) {
    console.error('Error creating personal tenant:', error);
  }

  const memberships = await tenantService.getUserTenants(user.id);
  const tenants = memberships.map((m) => ({
    ...m.tenant,
    role: m.role,
    status: m.status,
  }));

  console.log(`Found ${tenants.length} tenants for user ${user.id}`);

  return c.json({
    success: true,
    tenants,
  });
}

/**
 * Get details of a specific tenant
 */
export async function getTenantDetails(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const id = c.req.param('id');
  console.log(`Getting tenant details for tenant ${id} (user: ${user.id})`);

  const tenant = await tenantRepository.getTenantById(id);
  if (!tenant) {
    return c.json({ success: false, message: 'Tenant not found' }, 404);
  }

  const members = await tenantRepository.getTenantMembers(id);

  return c.json({
    success: true,
    tenant: {
      ...tenant,
      members,
    },
  });
}

/**
 * Create a new tenant
 */
export async function createTenant(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const body = c.get('sanitizedBody') || await c.req.json();
  const data = tenantCreateSchema.parse(body);

  const tenant = await tenantService.createTenant({
    name: data.name,
    ownerId: user.id,
  });

  return c.json({
    success: true,
    tenant,
  }, 201);
}

/**
 * Update a tenant
 */
export async function updateTenant(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const id = c.req.param('id');
  const body = c.get('sanitizedBody') || await c.req.json();
  const { name } = tenantUpdateSchema.parse(body);

  const tenant = await tenantRepository.updateTenant(id, { name });

  if (!tenant) {
    return c.json({ success: false, message: 'Tenant not found' }, 404);
  }

  return c.json({
    success: true,
    tenant,
  });
}

/**
 * Delete a tenant
 */
export async function deleteTenant(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const id = c.req.param('id');

  // Check ownership
  const tenant = await tenantRepository.getTenantById(id);
  if (!tenant) {
    return c.json({ success: false, message: 'Tenant not found' }, 404);
  }

  if (tenant.ownerId !== user.id) {
    return c.json({ success: false, message: 'Only the owner can delete this tenant' }, 403);
  }

  await tenantRepository.deleteTenant(id);

  return c.json({
    success: true,
    message: 'Tenant deleted successfully',
  });
}

/**
 * Invite a user to a tenant
 */
export async function inviteUser(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const id = c.req.param('id');
  const body = c.get('sanitizedBody') || await c.req.json();
  const inviteData = tenantInviteSchema.parse(body);

  // Get tenant info for the response
  const tenant = await tenantRepository.getTenantById(id);
  if (!tenant) {
    return c.json({ success: false, message: 'Tenant not found' }, 404);
  }

  // Check if user is already a member
  const existingUser = await userService.getUserByEmail(inviteData.email);
  if (existingUser) {
    const existingMember = await tenantRepository.getTenantMember(id, existingUser.id);
    if (existingMember) {
      return c.json({
        success: false,
        message: 'User is already a member of this tenant',
      }, 400);
    }

    // Add as pending member
    await tenantService.addTenantMember({
      tenantId: id,
      userId: existingUser.id,
      role: inviteData.role,
      status: 'pending',
      invitedById: user.id,
    });

    return c.json({
      success: true,
      message: `Invitation sent to existing user ${inviteData.email}`,
    });
  }

  // Create email verification with invitation info
  const token = await emailVerificationService.createEmailVerification(
    inviteData.email,
    false,
    id,
    inviteData.role,
  );

  const baseUrl = env.ORIGIN || 'http://localhost:3000';
  const verificationLink = `${baseUrl}/verify-email/${token}`;

  if (env.isProd) {
    console.log(`[PRODUCTION] Would send invitation email to ${inviteData.email} with link: ${verificationLink}`);
    return c.json({
      success: true,
      message: `Invitation sent to ${inviteData.email}`,
    });
  }

  // Development mode
  console.log(`\n===== DEVELOPMENT MODE =====`);
  console.log(`Invitation link for ${inviteData.email} to join "${tenant.name}":`);
  console.log(`${verificationLink}`);
  console.log(`=============================\n`);

  return c.json({
    success: true,
    message: `Invitation sent to ${inviteData.email} (see console log for details)`,
    dev: {
      note: 'These fields are only included in development mode',
      verificationLink,
      token,
      directApiVerify: `/api/auth/verify-email/${token}`,
    },
  });
}

/**
 * Update a member's role
 */
export async function updateMemberRole(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const id = c.req.param('id');
  const userId = c.req.param('userId');
  const body = c.get('sanitizedBody') || await c.req.json();
  const { role } = tenantMemberUpdateSchema.parse(body);

  await tenantService.updateTenantMemberRole(id, userId, role);

  return c.json({
    success: true,
    message: 'Member role updated successfully',
  });
}

/**
 * Remove a member from a tenant
 */
export async function removeMember(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const id = c.req.param('id');
  const userId = c.req.param('userId');

  await tenantService.removeTenantMember(id, userId);

  return c.json({
    success: true,
    message: 'Member removed successfully',
  });
}

/**
 * Leave a tenant
 */
export async function leaveTenant(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const id = c.req.param('id');

  await tenantService.leaveTenant(id, user.id);

  return c.json({
    success: true,
    message: 'Left tenant successfully',
  });
}

/**
 * Accept all pending tenant invitations for the current user
 */
export async function acceptPendingInvitations(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  try {
    const activated = await tenantRepository.activatePendingMemberships(user.id);
    const count = activated.length;
    console.log(`Accepted ${count} pending invitations for user ${user.id}`);

    return c.json({
      success: true,
      message: `Accepted ${count} pending invitations`,
      updatedCount: count,
    });
  } catch (error) {
    console.error('Error accepting pending invitations:', error);
    return c.json({
      success: false,
      message: `Error accepting pending invitations: ${(error as Error).message}`,
    }, 500);
  }
}

/**
 * Force create a personal tenant (for debugging)
 */
export async function forceCreatePersonalTenant(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  if (!env.isDev) {
    return c.json({ success: false, message: 'Not available in production' }, 403);
  }

  try {
    const dbUser = await userService.getUserById(user.id);
    if (!dbUser) {
      return c.json({ success: false, message: 'User not found' }, 404);
    }

    console.log(`=== FORCE CREATE PERSONAL TENANT FOR USER ${user.id} ===`);

    const tenant = await tenantService.createPersonalTenantIfNeeded(user.id, dbUser.email);

    // Get all tenants for verification
    const allTenants = await tenantService.getUserTenants(user.id);

    return c.json({
      success: true,
      message: 'Personal tenant created/verified successfully',
      tenant,
      allTenants,
    });
  } catch (error) {
    console.error('Error forcing personal tenant creation:', error);
    return c.json({
      success: false,
      message: `Error creating personal tenant: ${(error as Error).message}`,
    }, 500);
  }
}
