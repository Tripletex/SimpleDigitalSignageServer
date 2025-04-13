/**
 * Simple script to test the enhanced device authentication logic
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Import the verification function directly from our build output
const { verifyDeviceSignature } = require('../build/server/src/utils/deviceAuth');

// Test data
const testData = JSON.stringify({
  deviceId: "test-device-123",
  challenge: "randomChallenge12345"
});

// Write test data to file
fs.writeFileSync('test-data.json', testData);

// Generate a key pair for testing
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

// Sign the test data with the private key
const sign = crypto.createSign('SHA256');
sign.update(testData);
const signature = sign.sign(privateKey, 'base64');

console.log('Test Data:', testData);
console.log('Signature (first 40 chars):', signature.substring(0, 40) + '...');
console.log('Public Key (first 40 chars):', publicKey.substring(0, 40) + '...');

// Verify the signature using our enhanced function
console.log('\nVerifying signature with our enhanced function:');
const isValid = verifyDeviceSignature(testData, signature, publicKey);

console.log('\nVerification result:', isValid ? '✅ VALID' : '❌ INVALID');

// For comparison, do a direct verification with Node.js crypto
console.log('\nVerifying directly with Node.js crypto:');
const verify = crypto.createVerify('SHA256');
verify.update(testData);
const directResult = verify.verify(publicKey, Buffer.from(signature, 'base64'));

console.log('Direct verification result:', directResult ? '✅ VALID' : '❌ INVALID');

// Print results
if (isValid && directResult) {
  console.log('\n✅ SUCCESS: Both verification methods succeeded');
} else if (!isValid && directResult) {
  console.log('\n❌ ERROR: Our function failed but native crypto succeeded');
} else if (isValid && !directResult) {
  console.log('\n⚠️ WARNING: Our function succeeded but native crypto failed');
} else {
  console.log('\n❌ ERROR: Both verification methods failed');
}