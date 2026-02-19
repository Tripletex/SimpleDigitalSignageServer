import { Request, Response, NextFunction } from 'express';
import { TenantMember } from '../models/TenantMember';
import { Tenant } from '../models/Tenant';
import { TenantMemberStatus, TenantRole } from '../../../shared/src/tenantData';

/**
 * Tenant Authorization Middleware
 * 
 * This middleware provides comprehensive tenant-level authorization checks
 * to prevent users from accessing resources belonging to tenants they are not members of.
 * 
 * SECURITY: This addresses the critical authorization bypass vulnerability where
 * users could access tenant-specific resources by manipulating URL parameters.
 */

interface TenantAuthOptions {
  allowedRoles?: TenantRole[];
  requireActiveStatus?: boolean;
  paramName?: string; // Which parameter contains the tenant ID (default: 'tenantId' or 'id')
}

/**
 * Cache for tenant membership checks to improve performance
 * Key format: `${userId}-${tenantId}`
 * Value: { roles: TenantRole[], status: TenantMemberStatus, lastChecked: Date }
 */
const membershipCache = new Map<string, {
  role: TenantRole;
  status: TenantMemberStatus;
  lastChecked: Date;
}>();

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Clear expired cache entries
 */
function clearExpiredCache(): void {
  const now = new Date();
  for (const [key, value] of membershipCache.entries()) {
    if (now.getTime() - value.lastChecked.getTime() > CACHE_TTL) {
      membershipCache.delete(key);
    }
  }
}

/**
 * Get tenant membership from cache or database
 */
async function getTenantMembership(userId: string, tenantId: string): Promise<{
  role: TenantRole;
  status: TenantMemberStatus;
} | null> {
  const cacheKey = `${userId}-${tenantId}`;
  
  // Check cache first
  const cached = membershipCache.get(cacheKey);
  if (cached && (Date.now() - cached.lastChecked.getTime()) < CACHE_TTL) {
    return { role: cached.role, status: cached.status };
  }
  
  // Query database
  const membership = await TenantMember.findOne({
    where: {
      userId,
      tenantId
    }
  });
  
  if (!membership) {
    return null;
  }
  
  // Update cache
  membershipCache.set(cacheKey, {
    role: membership.role,
    status: membership.status,
    lastChecked: new Date()
  });
  
  // Periodic cache cleanup
  if (Math.random() < 0.01) { // 1% chance to trigger cleanup
    clearExpiredCache();
  }
  
  return {
    role: membership.role,
    status: membership.status
  };
}

/**
 * Middleware factory to create tenant authorization middleware
 * 
 * @param options - Configuration options for the authorization check
 * @returns Express middleware function
 */
export function requireTenantAccess(options: TenantAuthOptions = {}): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const {
    allowedRoles = [TenantRole.OWNER, TenantRole.ADMIN, TenantRole.MEMBER],
    requireActiveStatus = true,
    paramName
  } = options;
  
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }
      
      // Extract tenant ID from URL parameters
      let tenantId: string;
      
      if (paramName) {
        tenantId = req.params[paramName];
      } else {
        // Try common parameter names
        tenantId = req.params.tenantId || req.params.id;
      }
      
      if (!tenantId) {
        res.status(400).json({
          success: false,
          message: 'Tenant ID parameter is required'
        });
        return;
      }
      
      // Validate tenant ID format (assuming UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(tenantId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid tenant ID format'
        });
        return;
      }
      
      // Check if tenant exists
      const tenant = await Tenant.findByPk(tenantId);
      if (!tenant) {
        res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
        return;
      }
      
      // Get user's membership in this tenant
      const membership = await getTenantMembership(req.user.id, tenantId);
      
      if (!membership) {
        // Log potential security violation
        console.warn(`[SECURITY] Authorization bypass attempt: User ${req.user.id} attempted to access tenant ${tenantId} without membership`);
        
        res.status(403).json({
          success: false,
          message: 'Access denied: You are not a member of this tenant'
        });
        return;
      }
      
      // Check if membership is active (if required)
      if (requireActiveStatus && membership.status !== TenantMemberStatus.ACTIVE) {
        console.warn(`[SECURITY] Inactive member access attempt: User ${req.user.id} (status: ${membership.status}) attempted to access tenant ${tenantId}`);
        
        res.status(403).json({
          success: false,
          message: 'Access denied: Your membership in this tenant is not active'
        });
        return;
      }
      
      // Check if user has required role
      if (!allowedRoles.includes(membership.role)) {
        console.warn(`[SECURITY] Insufficient role access attempt: User ${req.user.id} (role: ${membership.role}) attempted to access tenant ${tenantId}`);
        
        res.status(403).json({
          success: false,
          message: `Access denied: This action requires one of the following roles: ${allowedRoles.join(', ')}`
        });
        return;
      }
      
      // Attach tenant and membership info to request for use in controllers
      (req as any).tenant = tenant;
      (req as any).tenantMembership = membership;
      
      // Log successful authorization for security monitoring
      if (process.env.NODE_ENV === 'development') {
        console.log(`[TENANT-AUTH] User ${req.user.id} authorized for tenant ${tenantId} with role ${membership.role}`);
      }
      
      next();
      
    } catch (error) {
      console.error('[TENANT-AUTH] Error in tenant authorization middleware:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during authorization check'
      });
    }
  };
}

/**
 * Middleware to require OWNER role access
 */
export const requireTenantOwner = requireTenantAccess({
  allowedRoles: [TenantRole.OWNER]
});

/**
 * Middleware to require OWNER or ADMIN role access
 */
export const requireTenantAdmin = requireTenantAccess({
  allowedRoles: [TenantRole.OWNER, TenantRole.ADMIN]
});

/**
 * Middleware to require any active membership (OWNER, ADMIN, or MEMBER)
 */
export const requireTenantMember = requireTenantAccess({
  allowedRoles: [TenantRole.OWNER, TenantRole.ADMIN, TenantRole.MEMBER]
});

/**
 * Middleware for read-only access (all roles including pending members)
 */
export const requireTenantReadAccess = requireTenantAccess({
  allowedRoles: [TenantRole.OWNER, TenantRole.ADMIN, TenantRole.MEMBER],
  requireActiveStatus: false
});

/**
 * Validation middleware for tenant ID in different parameter positions
 */
export const validateTenantIdParam = (paramName: string = 'tenantId') => {
  return requireTenantAccess({ paramName });
};

/**
 * Utility function to manually check tenant access (for use in services)
 */
export async function checkTenantAccess(
  userId: string, 
  tenantId: string, 
  requiredRoles: TenantRole[] = [TenantRole.OWNER, TenantRole.ADMIN, TenantRole.MEMBER]
): Promise<{
  hasAccess: boolean;
  membership?: { role: TenantRole; status: TenantMemberStatus };
  reason?: string;
}> {
  try {
    // Check if tenant exists
    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) {
      return { hasAccess: false, reason: 'Tenant not found' };
    }
    
    // Get membership
    const membership = await getTenantMembership(userId, tenantId);
    if (!membership) {
      return { hasAccess: false, reason: 'User is not a member of this tenant' };
    }
    
    // Check if membership is active
    if (membership.status !== TenantMemberStatus.ACTIVE) {
      return { 
        hasAccess: false, 
        membership, 
        reason: 'Membership is not active' 
      };
    }
    
    // Check role
    if (!requiredRoles.includes(membership.role)) {
      return { 
        hasAccess: false, 
        membership, 
        reason: `Insufficient role: requires one of ${requiredRoles.join(', ')}` 
      };
    }
    
    return { hasAccess: true, membership };
    
  } catch (error) {
    console.error('Error checking tenant access:', error);
    return { hasAccess: false, reason: 'Internal error during access check' };
  }
}

/**
 * Cache management functions for testing and administration
 */
export const cacheManager = {
  /**
   * Clear all cached membership data
   */
  clearAll(): void {
    membershipCache.clear();
  },
  
  /**
   * Clear cache entries for a specific user
   */
  clearUser(userId: string): void {
    for (const key of membershipCache.keys()) {
      if (key.startsWith(`${userId}-`)) {
        membershipCache.delete(key);
      }
    }
  },
  
  /**
   * Clear cache entries for a specific tenant
   */
  clearTenant(tenantId: string): void {
    for (const key of membershipCache.keys()) {
      if (key.endsWith(`-${tenantId}`)) {
        membershipCache.delete(key);
      }
    }
  },
  
  /**
   * Get cache statistics
   */
  getStats(): { size: number; entries: string[] } {
    return {
      size: membershipCache.size,
      entries: Array.from(membershipCache.keys())
    };
  }
};

// Extend Request interface to include tenant information
declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
      tenantMembership?: {
        role: TenantRole;
        status: TenantMemberStatus;
      };
    }
  }
}