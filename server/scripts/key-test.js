#!/usr/bin/env node

/**
 * Script to test key encoding/decoding for device authentication
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Create test directory
const testDir = path.join(__dirname, 'key-test');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Generate keys
console.log('Generating RSA keys...');
const privateKeyPath = path.join(testDir, 'device_private.pem');
const publicKeyPath = path.join(testDir, 'device_public.pem');

// Generate using OpenSSL (same as client script)
execSync(`openssl genrsa -out ${privateKeyPath} 2048`);
execSync(`openssl rsa -in ${privateKeyPath} -pubout -out ${publicKeyPath}`);

// Read the keys
const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const publicKey = fs.readFileSync(publicKeyPath, 'utf8');

console.log('\nPUBLIC KEY (original):');
console.log(publicKey.substring(0, 100) + '...');

// Base64 encode the public key (simulating storage in database)
const publicKeyBase64 = Buffer.from(publicKey).toString('base64');

// Decode the base64 key (simulating retrieval from database)
const decodedPublicKey = Buffer.from(publicKeyBase64, 'base64').toString('utf8');
console.log('\nDo original and decoded public keys match?', 
  publicKey.trim() === decodedPublicKey.trim() ? 'Yes' : 'No');

// Test data signing
const testData = JSON.stringify({ deviceId: 'test-device', challenge: 'test-challenge' });
fs.writeFileSync(path.join(testDir, 'test-data.json'), testData);

// Sign using OpenSSL (like the client test script)
console.log('\nSigning test data with OpenSSL...');
const signaturePath = path.join(testDir, 'signature.bin');
execSync(`openssl dgst -sha256 -sign ${privateKeyPath} -out ${signaturePath} ${path.join(testDir, 'test-data.json')}`);

// Convert signature to base64
const signatureBin = fs.readFileSync(signaturePath);
const signatureBase64 = signatureBin.toString('base64');

// Verification tests
console.log('\nVerifying signature:');

// Method 1: Standard createVerify with original key
try {
  const verifier = crypto.createVerify('SHA256');
  verifier.update(testData);
  const result = verifier.verify(publicKey, signatureBin);
  console.log('1. Using original key:', result ? 'SUCCESS' : 'FAILED');
} catch (error) {
  console.log('1. Using original key: ERROR -', error.message);
}

// Method 2: Using decoded key
try {
  const verifier = crypto.createVerify('SHA256');
  verifier.update(testData);
  const result = verifier.verify(decodedPublicKey, signatureBin);
  console.log('2. Using decoded key:', result ? 'SUCCESS' : 'FAILED');
} catch (error) {
  console.log('2. Using decoded key: ERROR -', error.message);
}

// Method 3: OpenSSL direct verification
try {
  fs.writeFileSync(path.join(testDir, 'verify-key.pem'), decodedPublicKey);
  const output = execSync(
    `openssl dgst -sha256 -verify ${path.join(testDir, 'verify-key.pem')} -signature ${signaturePath} ${path.join(testDir, 'test-data.json')}`
  ).toString().trim();
  console.log('3. OpenSSL verification:', output);
} catch (error) {
  console.log('3. OpenSSL verification: ERROR -', error.message);
}

console.log('\nTest files saved in:', testDir);