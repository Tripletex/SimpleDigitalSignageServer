/**
 * Tenant Security Middleware
 *
 * Provides Row Level Security (RLS) support by attaching a `secureQuery`
 * function to the Hono context. The function acquires a raw postgres
 * connection, sets the current user ID for PostgreSQL RLS policies,
 * executes the callback, and releases the connection.
 */

import type { Context, Next } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { queryClient } from '../db/client.ts';

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Attach a tenant-scoped secure query helper to the request context.
 *
 * The `secureQuery` function:
 * 1. Reserves a connection from the postgres pool.
 * 2. Sets `app.current_user_id` via `SET LOCAL` for RLS policies.
 * 3. Invokes the caller-supplied callback with the raw connection.
 * 4. Releases the connection when the callback completes (or throws).
 *
 * Skipped when no authenticated user is present on the session.
 */
export async function attachTenantSecurityContext(
  c: Context<AppEnv>,
  next: Next,
): Promise<void> {
  const session = c.get('session');

  // Skip if no authenticated user
  if (!session?.userId) {
    await next();
    return;
  }

  const userId = session.userId as string;

  /**
   * Execute a callback within a connection that has the current user set
   * for Row Level Security policies.
   */
  const secureQuery = async <T>(
    callback: (client: unknown) => Promise<T>,
  ): Promise<T> => {
    // Reserve an exclusive connection from the pool
    const reserved = await queryClient.reserve();

    try {
      // Set the user context for RLS
      await reserved`SET LOCAL app.current_user_id = ${userId}`;

      // Execute the caller's query logic
      return await callback(reserved);
    } finally {
      // Always release back to the pool
      reserved.release();
    }
  };

  c.set('secureQuery', secureQuery);

  await next();
}
