/**
 * Tenant Authorization Middleware
 *
 * Provides comprehensive tenant-level authorization checks to prevent
 * users from accessing resources belonging to tenants they are not
 * members of.
 *
 * SECURITY: Addresses the critical authorization bypass vulnerability where
 * users could access tenant-specific resources by manipulating URL parameters.
 */

import type { Context, Next } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { queryClient } from '../db/client.ts';
import { env } from '../config/env.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Tenant roles (mirroring shared/src/tenantData.ts) */
const TenantRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;
type TenantRoleType = (typeof TenantRole)[keyof typeof TenantRole];

/** Tenant member statuses */
const TenantMemberStatus = {
  ACTIVE: 'active',
  PENDING: 'pending',
} as const;
type TenantMemberStatusType = (typeof TenantMemberStatus)[keyof typeof TenantMemberStatus];

interface TenantAuthOptions {
  allowedRoles?: TenantRoleType[];
  requireActiveStatus?: boolean;
  /** Which URL parameter contains the tenant ID (default: 'tenantId' or 'id') */
  paramName?: string;
}

interface MembershipEntry {
  role: TenantRoleType;
  status: TenantMemberStatusType;
  lastChecked: Date;
}

// ---------------------------------------------------------------------------
// Membership cache (Map-based with 5-minute TTL)
// ---------------------------------------------------------------------------

const membershipCache = new Map<string, MembershipEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function clearExpiredCache(): void {
  const now = Date.now();
  for (const [key, value] of membershipCache.entries()) {
    if (now - value.lastChecked.getTime() > CACHE_TTL) {
      membershipCache.delete(key);
    }
  }
}

/**
 * Get tenant membership from cache or database.
 */
async function getTenantMembership(
  userId: string,
  tenantId: string,
): Promise<{ role: TenantRoleType; status: TenantMemberStatusType } | null> {
  const cacheKey = `${userId}-${tenantId}`;

  // Check cache first
  const cached = membershipCache.get(cacheKey);
  if (cached && Date.now() - cached.lastChecked.getTime() < CACHE_TTL) {
    return { role: cached.role, status: cached.status };
  }

  // Query database
  const rows = await queryClient`
    SELECT role, status FROM tenant_members
    WHERE user_id = ${userId} AND tenant_id = ${tenantId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return null;
  }

  const membership = {
    role: rows[0].role as TenantRoleType,
    status: rows[0].status as TenantMemberStatusType,
  };

  // Update cache
  membershipCache.set(cacheKey, {
    ...membership,
    lastChecked: new Date(),
  });

  // Probabilistic cache cleanup (1% chance)
  if (Math.random() < 0.01) {
    clearExpiredCache();
  }

  return membership;
}

// ---------------------------------------------------------------------------
// UUID validation
// ---------------------------------------------------------------------------

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

/**
 * Create tenant authorization middleware with the given options.
 *
 * @param options - Configuration for the authorization check.
 * @returns Hono middleware function.
 */
export function requireTenantAccess(
  options: TenantAuthOptions = {},
): (c: Context<AppEnv>, next: Next) => Promise<void | Response> {
  const {
    allowedRoles = [TenantRole.OWNER, TenantRole.ADMIN, TenantRole.MEMBER],
    requireActiveStatus = true,
    paramName,
  } = options;

  return async (c: Context<AppEnv>, next: Next): Promise<void | Response> => {
    try {
      // Check authentication
      const user = c.get('user');
      if (!user) {
        return c.json({ success: false, message: 'Authentication required' }, 401);
      }

      // Extract tenant ID from URL parameters
      let tenantId: string | undefined;
      if (paramName) {
        tenantId = c.req.param(paramName);
      } else {
        tenantId = c.req.param('tenantId') || c.req.param('id');
      }

      if (!tenantId) {
        return c.json({ success: false, message: 'Tenant ID parameter is required' }, 400);
      }

      // Validate UUID format
      if (!UUID_REGEX.test(tenantId)) {
        return c.json({ success: false, message: 'Invalid tenant ID format' }, 400);
      }

      // Check if tenant exists
      const tenantRows = await queryClient`
        SELECT id, name FROM tenants WHERE id = ${tenantId} LIMIT 1
      `;

      if (tenantRows.length === 0) {
        return c.json({ success: false, message: 'Tenant not found' }, 404);
      }

      const tenant = tenantRows[0];

      // Get user's membership in this tenant
      const membership = await getTenantMembership(user.id, tenantId);

      if (!membership) {
        console.warn(
          `[SECURITY] Authorization bypass attempt: User ${user.id} attempted to access tenant ${tenantId} without membership`,
        );
        return c.json(
          { success: false, message: 'Access denied: You are not a member of this tenant' },
          403,
        );
      }

      // Check active status if required
      if (requireActiveStatus && membership.status !== TenantMemberStatus.ACTIVE) {
        console.warn(
          `[SECURITY] Inactive member access attempt: User ${user.id} (status: ${membership.status}) attempted to access tenant ${tenantId}`,
        );
        return c.json(
          { success: false, message: 'Access denied: Your membership in this tenant is not active' },
          403,
        );
      }

      // Check required role
      if (!allowedRoles.includes(membership.role)) {
        console.warn(
          `[SECURITY] Insufficient role access attempt: User ${user.id} (role: ${membership.role}) attempted to access tenant ${tenantId}`,
        );
        return c.json(
          {
            success: false,
            message: `Access denied: This action requires one of the following roles: ${allowedRoles.join(', ')}`,
          },
          403,
        );
      }

      // Attach tenant and membership info to context
      c.set('tenant', tenant);
      c.set('tenantMembership', membership);

      if (env.isDev) {
        console.log(
          `[TENANT-AUTH] User ${user.id} authorized for tenant ${tenantId} with role ${membership.role}`,
        );
      }

      await next();
    } catch (error) {
      console.error('[TENANT-AUTH] Error in tenant authorization middleware:', error);
      return c.json(
        { success: false, message: 'Internal server error during authorization check' },
        500,
      );
    }
  };
}

// ---------------------------------------------------------------------------
// Pre-built middleware instances
// ---------------------------------------------------------------------------

/** Require OWNER role access. */
export const requireTenantOwner = requireTenantAccess({
  allowedRoles: [TenantRole.OWNER],
});

/** Require OWNER or ADMIN role access. */
export const requireTenantAdmin = requireTenantAccess({
  allowedRoles: [TenantRole.OWNER, TenantRole.ADMIN],
});

/** Require any active membership (OWNER, ADMIN, or MEMBER). */
export const requireTenantMember = requireTenantAccess({
  allowedRoles: [TenantRole.OWNER, TenantRole.ADMIN, TenantRole.MEMBER],
});

/** Read-only access — all roles including pending members. */
export const requireTenantReadAccess = requireTenantAccess({
  allowedRoles: [TenantRole.OWNER, TenantRole.ADMIN, TenantRole.MEMBER],
  requireActiveStatus: false,
});

// ---------------------------------------------------------------------------
// Utility function for use in services
// ---------------------------------------------------------------------------

/**
 * Manually check whether a user has access to a tenant.
 */
export async function checkTenantAccess(
  userId: string,
  tenantId: string,
  requiredRoles: TenantRoleType[] = [TenantRole.OWNER, TenantRole.ADMIN, TenantRole.MEMBER],
): Promise<{
  hasAccess: boolean;
  membership?: { role: TenantRoleType; status: TenantMemberStatusType };
  reason?: string;
}> {
  try {
    // Check tenant existence
    const tenantRows = await queryClient`
      SELECT id FROM tenants WHERE id = ${tenantId} LIMIT 1
    `;
    if (tenantRows.length === 0) {
      return { hasAccess: false, reason: 'Tenant not found' };
    }

    // Get membership
    const membership = await getTenantMembership(userId, tenantId);
    if (!membership) {
      return { hasAccess: false, reason: 'User is not a member of this tenant' };
    }

    // Check active status
    if (membership.status !== TenantMemberStatus.ACTIVE) {
      return { hasAccess: false, membership, reason: 'Membership is not active' };
    }

    // Check role
    if (!requiredRoles.includes(membership.role)) {
      return {
        hasAccess: false,
        membership,
        reason: `Insufficient role: requires one of ${requiredRoles.join(', ')}`,
      };
    }

    return { hasAccess: true, membership };
  } catch (error) {
    console.error('Error checking tenant access:', error);
    return { hasAccess: false, reason: 'Internal error during access check' };
  }
}

// ---------------------------------------------------------------------------
// Cache management (exported for testing and administration)
// ---------------------------------------------------------------------------

export const cacheManager = {
  /** Clear all cached membership data. */
  clearAll(): void {
    membershipCache.clear();
  },

  /** Clear cache entries for a specific user. */
  clearUser(userId: string): void {
    for (const key of membershipCache.keys()) {
      if (key.startsWith(`${userId}-`)) {
        membershipCache.delete(key);
      }
    }
  },

  /** Clear cache entries for a specific tenant. */
  clearTenant(tenantId: string): void {
    for (const key of membershipCache.keys()) {
      if (key.endsWith(`-${tenantId}`)) {
        membershipCache.delete(key);
      }
    }
  },

  /** Get cache statistics. */
  getStats(): { size: number; entries: string[] } {
    return {
      size: membershipCache.size,
      entries: Array.from(membershipCache.keys()),
    };
  },
};
