/**
 * Simple test for device signature verification
 */
import crypto from 'crypto';
import { verifyDeviceSignature } from './deviceAuth';

// Generate test key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
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

// Create test data
const testData = JSON.stringify({
  deviceId: "test-device-123",
  challenge: "randomChallenge12345"
});

// Sign the test data
const sign = crypto.createSign('SHA256');
sign.update(testData);
const signature = sign.sign(privateKey, 'base64');

console.log('Test Data:', testData);
console.log('Public Key (excerpt):', publicKey.substring(0, 40) + '...');
console.log('Signature (excerpt):', signature.substring(0, 40) + '...');

// Verify with our function
console.log('\nVerifying with our enhanced function:');
const isValid = verifyDeviceSignature(testData, signature, publicKey);
console.log('Result:', isValid ? '✅ VALID' : '❌ INVALID');

// Direct verification for comparison
const verify = crypto.createVerify('SHA256');
verify.update(testData);
const directResult = verify.verify(publicKey, Buffer.from(signature, 'base64'));
console.log('\nDirect verification result:', directResult ? '✅ VALID' : '❌ INVALID');