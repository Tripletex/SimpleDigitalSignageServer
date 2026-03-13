/**
 * @deprecated JWT tokens have been replaced with API keys for device authentication.
 * This file is kept for backward compatibility only.
 */

// Generate a fake token for backward compatibility
export const generateDeviceToken = (deviceId: string): string => {
  console.warn('[DEPRECATED] generateDeviceToken is deprecated, use API keys instead');
  return `deprecated-jwt-${deviceId}-${Date.now()}`;
};

// Always return null for verification (forcing apps to use API keys)
export const verifyDeviceToken = (token: string): { sub: string } | null => {
  console.warn('[DEPRECATED] verifyDeviceToken is deprecated, use API keys instead');
  return null;
};

// Always return null for token expiration (API keys handle this differently)
export const getTokenExpiration = (token: string): number | null => {
  console.warn('[DEPRECATED] getTokenExpiration is deprecated, use API keys instead');
  return null;
};