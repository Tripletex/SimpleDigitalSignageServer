/**
 * Setup Controller
 *
 * Health checks, debug endpoints, and development utilities.
 */

import type { Context } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { env } from '../config/env.ts';
import { testConnection, queryClient } from '../db/client.ts';

/**
 * Check database connection and server status
 */
export async function healthCheck(c: Context<AppEnv>): Promise<Response> {
  try {
    const dbConnected = await testConnection();

    if (env.isDev) {
      // Full detailed response for development
      const [
        userCount,
        tenantCount,
        tenantMemberCount,
        deviceCount,
      ] = await Promise.all([
        queryClient`SELECT COUNT(*) FROM users`,
        queryClient`SELECT COUNT(*) FROM tenants`,
        queryClient`SELECT COUNT(*) FROM tenant_members`,
        queryClient`SELECT COUNT(*) FROM devices`,
      ]);

      const tables = await queryClient`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
      `;

      return c.json({
        success: true,
        status: 'Server is running',
        database: {
          connected: dbConnected,
          tables,
          counts: {
            users: userCount[0].count,
            tenants: tenantCount[0].count,
            tenantMembers: tenantMemberCount[0].count,
            devices: deviceCount[0].count,
          },
        },
        environment: {
          nodeEnv: env.NODE_ENV,
          dbHost: env.DB_HOST,
          dbName: env.DB_NAME,
        },
        version: '1.0.0',
      });
    }

    // Minimal response for production
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Server is running',
    });
  } catch (error) {
    console.error('Health check error:', error);
    if (env.isDev) {
      return c.json({
        status: 'error',
        timestamp: new Date().toISOString(),
        message: 'Health check failed',
        error: String(error),
      }, 500);
    }
    return c.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      message: 'Health check failed',
    }, 500);
  }
}

/**
 * Debug tenant relationships for a specific user
 */
export async function debugUserTenants(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  if (!env.isDev) {
    return c.json({ success: false, message: 'Not available in production' }, 403);
  }

  try {
    const userId = user.id;

    const [userData, allTenants, tenantMembers, personalTenants, allTenantMembers] = await Promise.all([
      queryClient`SELECT * FROM users WHERE id = ${userId}`,
      queryClient`SELECT * FROM tenants`,
      queryClient`SELECT * FROM tenant_members WHERE user_id = ${userId}`,
      queryClient`SELECT * FROM tenants WHERE is_personal = true`,
      queryClient`SELECT * FROM tenant_members`,
    ]);

    return c.json({
      success: true,
      debug: {
        user: userData,
        tenants: allTenants,
        tenantMembers,
        personalTenants,
        allTenantMembers,
        counts: {
          totalTenants: allTenants.length,
          personalTenants: personalTenants.length,
          userTenantMemberships: tenantMembers.length,
          allTenantMembers: allTenantMembers.length,
        },
      },
    });
  } catch (error) {
    console.error('Debug tenant error:', error);
    return c.json({
      success: false,
      error: String(error),
    }, 500);
  }
}

/**
 * Reset users in development mode
 * WARNING: This is a destructive operation that should only be used in development
 */
export async function resetUsers(c: Context<AppEnv>): Promise<Response> {
  if (!env.isDev) {
    return c.json({
      success: false,
      message: 'This endpoint is only available in development mode',
    }, 403);
  }

  try {
    // Delete all related data in the correct order
    await queryClient`DELETE FROM tenant_members`;
    console.log('Deleted all tenant memberships');

    await queryClient`DELETE FROM tenants`;
    console.log('Deleted all tenants');

    await queryClient`DELETE FROM authenticators`;
    console.log('Deleted all authenticators');

    await queryClient`DELETE FROM users`;
    console.log('Deleted all users');

    return c.json({
      success: true,
      message: 'All users, tenants, and related data have been reset',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error resetting users:', error);
    return c.json({
      success: false,
      error: String(error),
    }, 500);
  }
}
