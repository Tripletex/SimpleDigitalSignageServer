/**
 * User Controller
 *
 * Handles user CRUD, profile management, and passkey (authenticator) management.
 */

import type { Context } from 'hono';
import type { AppEnv } from '../types/context.ts';
import userService from '../services/user.ts';
import authenticatorRepository from '../repositories/authenticator.ts';

/**
 * Get all users (admin only)
 */
export async function getAllUsers(c: Context<AppEnv>): Promise<Response> {
  const users = await userService.getAllUsers();

  // Apply search filter if provided
  const search = c.req.query('search');
  const roleFilter = c.req.query('role');

  let filteredUsers = users;
  if (search) {
    const searchTerm = search.toLowerCase();
    filteredUsers = filteredUsers.filter((u) =>
      u.email.toLowerCase().includes(searchTerm) ||
      u.displayName?.toLowerCase().includes(searchTerm)
    );
  }

  if (roleFilter) {
    filteredUsers = filteredUsers.filter((u) => u.role === roleFilter);
  }

  const safeUsers = filteredUsers.map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    createdAt: u.createdAt,
  }));

  return c.json({
    success: true,
    users: safeUsers,
    total: safeUsers.length,
  });
}

/**
 * Get user by ID (admin only)
 */
export async function getUserById(c: Context<AppEnv>): Promise<Response> {
  const id = c.req.param('id');
  const user = await userService.getUserById(id);

  if (!user) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  const authenticators = await authenticatorRepository.getAuthenticatorsByUserId(id);

  return c.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      createdAt: user.createdAt,
      authenticatorCount: authenticators.length,
    },
  });
}

/**
 * Update user (admin only)
 */
export async function updateUser(c: Context<AppEnv>): Promise<Response> {
  const id = c.req.param('id');
  const body = (c.get('sanitizedBody') || await c.req.json()) as { displayName?: string; email?: string; role?: 'admin' | 'user' };
  const { displayName, email, role } = body;

  const updatedUser = await userService.updateUser(id, {
    displayName,
    email,
    role,
  });

  if (!updatedUser) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  return c.json({
    success: true,
    message: 'User updated successfully',
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      displayName: updatedUser.displayName,
      role: updatedUser.role,
    },
  });
}

/**
 * Delete user (admin only)
 */
export async function deleteUser(c: Context<AppEnv>): Promise<Response> {
  const id = c.req.param('id');

  // Check if deleting self
  const user = c.get('user');
  if (user && user.id === id) {
    return c.json({
      success: false,
      message: 'Cannot delete your own account',
    }, 400);
  }

  await userService.deleteUser(id);

  return c.json({
    success: true,
    message: 'User deleted successfully',
  });
}

/**
 * Get current user's profile
 */
export async function getProfile(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const dbUser = await userService.getUserById(user.id);
  if (!dbUser) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  const authenticators = await authenticatorRepository.getAuthenticatorsByUserId(user.id);

  return c.json({
    success: true,
    profile: {
      id: dbUser.id,
      email: dbUser.email,
      displayName: dbUser.displayName,
      role: dbUser.role,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
      authenticatorCount: authenticators.length,
    },
  });
}

/**
 * Update current user's profile
 */
export async function updateProfile(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const body = c.get('sanitizedBody') || await c.req.json();
  const { displayName } = body;

  if (!displayName || typeof displayName !== 'string' || displayName.trim() === '') {
    return c.json({
      success: false,
      message: 'Display name is required and must be a valid string',
    }, 400);
  }

  const trimmed = displayName.trim();

  if (trimmed.length > 100) {
    return c.json({
      success: false,
      message: 'Display name must be 100 characters or less',
    }, 400);
  }

  const updatedUser = await userService.updateUser(user.id, {
    displayName: trimmed,
  });

  if (!updatedUser) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  return c.json({
    success: true,
    message: 'Profile updated successfully',
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      displayName: updatedUser.displayName,
      role: updatedUser.role,
    },
  });
}

/**
 * Get user's passkeys
 */
export async function getPasskeys(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  try {
    const authenticators = await authenticatorRepository.getAuthenticatorsByUserId(user.id);

    const passkeys = authenticators.map((auth, index) => ({
      id: auth.id,
      name: auth.name || `Passkey ${index + 1}`,
      createdAt: auth.createdAt,
    }));

    return c.json({
      success: true,
      passkeys,
    });
  } catch (error) {
    console.error(`Error fetching passkeys: ${error}`);
    return c.json({
      success: true,
      passkeys: [],
      error: `Error fetching passkeys: ${error}`,
    });
  }
}

/**
 * Update passkey name
 */
export async function updatePasskeyName(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const id = c.req.param('id');
  const body = c.get('sanitizedBody') || await c.req.json();
  const { name } = body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return c.json({
      success: false,
      message: 'Passkey name is required and must be a valid string',
    }, 400);
  }

  const trimmed = name.trim();
  if (trimmed.length > 50) {
    return c.json({
      success: false,
      message: 'Passkey name must be 50 characters or less',
    }, 400);
  }

  // Find the authenticator and verify it belongs to the current user
  const authenticators = await authenticatorRepository.getAuthenticatorsByUserId(user.id);
  const authenticator = authenticators.find((a) => a.id === id);

  if (!authenticator) {
    return c.json({
      success: false,
      message: 'Passkey not found or does not belong to you',
    }, 404);
  }

  // Update via raw query since repository doesn't have an update-name method
  const { queryClient } = await import('../db/client.ts');
  await queryClient`
    UPDATE authenticators SET name = ${trimmed}, updated_at = now()
    WHERE id = ${id} AND user_id = ${user.id}
  `;

  return c.json({
    success: true,
    message: 'Passkey name updated successfully',
    passkey: {
      id: authenticator.id,
      name: trimmed,
      createdAt: authenticator.createdAt,
    },
  });
}

/**
 * Delete passkey
 */
export async function deletePasskey(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const id = c.req.param('id');

  // Find the authenticator and verify it belongs to the current user
  const authenticators = await authenticatorRepository.getAuthenticatorsByUserId(user.id);
  const authenticator = authenticators.find((a) => a.id === id);

  if (!authenticator) {
    return c.json({
      success: false,
      message: 'Passkey not found or does not belong to you',
    }, 404);
  }

  // Make sure it's not the last passkey
  if (authenticators.length <= 1) {
    return c.json({
      success: false,
      message: 'Cannot delete your only passkey',
    }, 400);
  }

  await authenticatorRepository.deleteAuthenticator(id);

  return c.json({
    success: true,
    message: 'Passkey deleted successfully',
  });
}
