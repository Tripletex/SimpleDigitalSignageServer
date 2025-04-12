// utils/jwt.ts - JWT utilities for device authentication
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

// Load JWT secret from environment or generate one
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

/**
 * Generate a JWT token for a device
 * @param deviceId The device's unique ID
 * @returns JWT token
 */
export const generateDeviceToken = (deviceId: string): string => {
  const payload = {
    sub: deviceId,
    type: 'device',
    iat: Math.floor(Date.now() / 1000)
  };
  
  // Using 8 hours expiration by default
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
};

/**
 * Verify a device JWT token
 * @param token The JWT token to verify
 * @returns The decoded token payload or null if invalid
 */
export const verifyDeviceToken = (token: string): { sub: string } | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
    return decoded;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
};

/**
 * Calculate the expiration time for a JWT token
 * @param token The JWT token
 * @returns Expiration time in milliseconds since epoch, or null if invalid
 */
export const getTokenExpiration = (token: string): number | null => {
  try {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    return decoded?.exp ? decoded.exp * 1000 : null; // Convert to milliseconds
  } catch (error) {
    return null;
  }
};