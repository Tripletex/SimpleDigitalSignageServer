/**
 * Authentication Middleware
 *
 * Provides session-based authentication checks and role-based guards.
 */

import type { Context, Next } from 'hono';
import type { AppEnv } from '../types/context.ts';

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Middleware to check if the user is authenticated.
 *
 * Reads userId / username / role from the session and populates
 * the `user` context variable. Returns 401 if no valid session exists.
 */
export async function isAuthenticated(
  c: Context<AppEnv>,
  next: Next,
): Promise<void | Response> {
  const session = c.get('session');

  if (session && session.userId) {
    c.set('user', {
      id: session.userId as string,
      email: session.username as string, // username field contains email
      role: session.role as string,
    });
    await next();
    return;
  }

  return c.json(
    { success: false, message: 'Authentication required' },
    401,
  );
}

/**
 * Middleware to check if the authenticated user has the admin role.
 * Must be used after `isAuthenticated`.
 */
export async function isAdmin(
  c: Context<AppEnv>,
  next: Next,
): Promise<void | Response> {
  const user = c.get('user');

  if (user && user.role === 'admin') {
    await next();
    return;
  }

  return c.json(
    { success: false, message: 'Admin access required' },
    403,
  );
}

/**
 * Higher-order middleware that skips authentication for the specified paths.
 *
 * @param paths - Array of exact path strings to exclude from authentication.
 * @returns A middleware function that either skips or applies `isAuthenticated`.
 */
export function excludeRoutes(
  paths: string[],
): (c: Context<AppEnv>, next: Next) => Promise<void | Response> {
  return async (c: Context<AppEnv>, next: Next): Promise<void | Response> => {
    const currentPath = c.req.path;

    if (paths.includes(currentPath)) {
      await next();
      return;
    }

    return isAuthenticated(c, next);
  };
}
