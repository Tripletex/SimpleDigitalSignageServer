import { UserProfile, Passkey } from '../types/user';
import { csrfFetch } from '../utils/csrfFetch';

/**
 * Fetch the current user's profile
 */
export const getUserProfile = async (): Promise<UserProfile> => {
  const response = await fetch('/api/users/profile');
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to fetch user profile');
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch user profile');
  }
  
  return data.profile;
};

/**
 * Update the current user's profile
 */
export const updateProfile = async (displayName: string): Promise<{ user: any }> => {
  const response = await csrfFetch('/api/users/update', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ displayName }),
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to update profile');
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.message || 'Failed to update profile');
  }
  
  return { user: data.user };
};

/**
 * Get the user's passkeys
 */
export const getPasskeys = async (): Promise<Passkey[]> => {
  const response = await fetch('/api/users/passkeys');
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to fetch passkeys');
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch passkeys');
  }
  
  return data.passkeys || [];
};

/**
 * Update a passkey's name
 */
export const updatePasskeyName = async (passkeyId: string, name: string): Promise<any> => {
  const response = await csrfFetch(`/api/users/passkeys/${passkeyId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to update passkey name');
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.message || 'Failed to update passkey name');
  }
  
  return data.passkey;
};

/**
 * Delete a passkey
 */
export const deletePasskey = async (passkeyId: string): Promise<void> => {
  const response = await csrfFetch(`/api/users/passkeys/${passkeyId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to delete passkey');
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.message || 'Failed to delete passkey');
  }
};