/**
 * Test script to verify signatures in the same way as the server will
 * This script works with files created by the device-ping-test.sh script
 */
const fs = require('fs');
const crypto = require('crypto');

// Read from files created by the device scripts
const privateKeyPem = fs.readFileSync('device_private_key.pem', 'utf8');
const publicKeyPem = fs.readFileSync('device_public_key.pem', 'utf8');
const dataToSign = fs.readFileSync('challenge_data.json', 'utf8');

// Convert public key to base64 as it would be stored in the database
const publicKeyBase64 = Buffer.from(publicKeyPem).toString('base64');

console.log('==== Signature Format Test ====');
console.log('Data to sign:', dataToSign);

// Create a signature with private key (as the device would)
const sign = crypto.createSign('SHA256');
sign.update(dataToSign);
const signature = sign.sign(privateKeyPem);
const signatureBase64 = signature.toString('base64');

console.log('Signature (base64):', signatureBase64.substring(0, 40) + '...');

// Verify signature using crypto's verify method with the public key PEM
const verify1 = crypto.createVerify('SHA256');
verify1.update(dataToSign);
const result1 = verify1.verify(publicKeyPem, signature);
console.log('Verification with direct PEM:', result1);

// Verify signature using public key in base64 format (decoded back to PEM)
const decodedPem = Buffer.from(publicKeyBase64, 'base64').toString('utf8');
const verify2 = crypto.createVerify('SHA256');
verify2.update(dataToSign);
const result2 = verify2.verify(decodedPem, signature);
console.log('Verification with base64-decoded PEM:', result2);

// Check if the original public key and decoded one match
console.log('Public keys match:', publicKeyPem === decodedPem);

// Also check signature created with openssl
if (fs.existsSync('signature.bin')) {
  console.log('\n==== Testing OpenSSL Signature ====');
  const opensslSig = fs.readFileSync('signature.bin');
  const opensslBase64 = opensslSig.toString('base64');
  
  console.log('OpenSSL signature length:', opensslSig.length);
  console.log('Node signature length:', signature.length);
  
  const verify3 = crypto.createVerify('SHA256');
  verify3.update(dataToSign);
  try {
    const result3 = verify3.verify(publicKeyPem, opensslSig);
    console.log('Verification with OpenSSL signature:', result3);
  } catch (e) {
    console.error('Error verifying OpenSSL signature:', e.message);
  }
}

// Detailed key information
console.log('\n==== Key Details ====');
console.log('Private key starts with:', privateKeyPem.substring(0, 40) + '...');
console.log('Public key starts with:', publicKeyPem.substring(0, 40) + '...');
console.log('Decoded public key starts with:', decodedPem.substring(0, 40) + '...');