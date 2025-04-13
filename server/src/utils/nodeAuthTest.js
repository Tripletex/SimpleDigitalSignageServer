// Test the device authentication signature verification locally
const crypto = require('crypto');
const fs = require('fs');

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

// Save the keys to files
fs.writeFileSync('test_private_key.pem', privateKey);
fs.writeFileSync('test_public_key.pem', publicKey);

// Convert public key to base64 for storage
const publicKeyBase64 = Buffer.from(publicKey).toString('base64');
console.log('Public key (base64):', publicKeyBase64.substring(0, 50) + '...');

// Test data to sign
const deviceId = 'test-device-123';
const challenge = 'random-challenge-string';
const dataToSign = JSON.stringify({ deviceId, challenge });
console.log('Data to sign:', dataToSign);

// Sign the data with the private key
const sign = crypto.createSign('SHA256');
sign.update(dataToSign);
sign.end();
const signature = sign.sign(privateKey);
const signatureBase64 = signature.toString('base64');
console.log('Signature (base64, first 50 chars):', signatureBase64.substring(0, 50) + '...');

// Now test verification - decode the base64 public key back to PEM format
const publicKeyPem = Buffer.from(publicKeyBase64, 'base64').toString('utf8');
console.log('Decoded public key (first 50 chars):', publicKeyPem.substring(0, 50) + '...');

// Verify the signature
const verify = crypto.createVerify('SHA256');
verify.update(dataToSign);
verify.end();

try {
  const result = verify.verify(publicKeyPem, signature);
  console.log('Verification result:', result);
} catch (error) {
  console.error('Verification error:', error);
}

// Let's verify these match too
console.log('\nVerifying public key matches:');
console.log('Original public key (first 50 chars):', publicKey.substring(0, 50) + '...');
console.log('Decoded public key (first 50 chars):', publicKeyPem.substring(0, 50) + '...');
console.log('Match result:', publicKey === publicKeyPem);