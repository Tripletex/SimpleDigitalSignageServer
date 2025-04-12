// Utils for device authentication
import { DeviceData } from '../../../shared/src/deviceData';
import { DeviceRegistration } from '../models/DeviceRegistration';
import crypto from 'crypto';

/**
 * Validates device signature from ping data
 * @param deviceData The device data sent in ping request
 * @param publicKey The device's public key stored during registration
 * @returns true if signature is valid, false otherwise
 */
export const verifyDeviceSignature = (deviceData: DeviceData, publicKey: string): boolean => {
  try {
    // Extract signature and timestamp
    const { signature, timestamp } = deviceData;
    
    if (!signature || !timestamp) {
      console.log('[AUTH] Missing signature or timestamp');
      return false;
    }
    
    // Create a copy of the data without the signature for verification
    const dataToVerify = { ...deviceData };
    delete dataToVerify.signature;
    
    // Check timestamp to prevent replay attacks (within 5 minutes)
    const now = Date.now();
    const fiveMinutesInMillis = 5 * 60 * 1000;
    if (Math.abs(now - timestamp) > fiveMinutesInMillis) {
      console.log('[AUTH] Timestamp too old or in future');
      return false;
    }
    
    // Convert base64 public key to buffer
    const publicKeyBuffer = Buffer.from(publicKey, 'base64');
    
    // Create a string representation of device data for verification
    const dataString = JSON.stringify(dataToVerify);
    
    // Create a verifier using the public key
    const verifier = crypto.createVerify('SHA256');
    verifier.update(dataString);
    
    // Verify the signature
    const signatureBuffer = Buffer.from(signature, 'base64');
    const isValid = verifier.verify(publicKeyBuffer, signatureBuffer);
    
    console.log(`[AUTH] Signature verification ${isValid ? 'succeeded' : 'failed'}`);
    return isValid;
  } catch (error) {
    console.error('[AUTH] Error verifying signature:', error);
    return false;
  }
};

/**
 * Generate key pair for testing purposes
 * @returns Object containing private and public keys
 */
export const generateKeyPair = (): { privateKey: string, publicKey: string } => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  
  // Convert to base64 for easier storage and transmission
  return {
    privateKey: Buffer.from(privateKey).toString('base64'),
    publicKey: Buffer.from(publicKey).toString('base64')
  };
};

/**
 * Sign device data using private key
 * @param deviceData Device data to sign
 * @param privateKeyBase64 Base64-encoded private key
 * @returns Signed device data with signature and timestamp
 */
export const signDeviceData = (
  deviceData: DeviceData, 
  privateKeyBase64: string
): DeviceData => {
  try {
    // Make a copy without any existing signature
    const dataToSign = { ...deviceData };
    delete dataToSign.signature;
    
    // Add current timestamp
    dataToSign.timestamp = Date.now();
    
    // Convert data to string
    const dataString = JSON.stringify(dataToSign);
    
    // Convert base64 private key to buffer and then to PEM format
    const privateKeyBuffer = Buffer.from(privateKeyBase64, 'base64');
    
    // Create a signer using the private key
    const signer = crypto.createSign('SHA256');
    signer.update(dataString);
    
    // Sign the data
    const signature = signer.sign(privateKeyBuffer);
    
    // Return device data with signature
    return {
      ...dataToSign,
      signature: signature.toString('base64')
    };
  } catch (error) {
    console.error('[AUTH] Error signing device data:', error);
    throw new Error('Failed to sign device data');
  }
};