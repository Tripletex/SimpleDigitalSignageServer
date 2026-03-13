#!/usr/bin/env node

/**
 * Test script to check different JSON formatting
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Create test directory
const testDir = path.join(__dirname, 'challenge-test');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Generate keys
console.log('Generating RSA keys...');
const privateKeyPath = path.join(testDir, 'device_private.pem');
const publicKeyPath = path.join(testDir, 'device_public.pem');

execSync(`openssl genrsa -out ${privateKeyPath} 2048`);
execSync(`openssl rsa -in ${privateKeyPath} -pubout -out ${publicKeyPath}`);

const deviceId = 'test-device-' + Date.now();
const challenge = crypto.randomBytes(32).toString('base64');

// Create challenge data to sign in different formats

// Format 1: Multi-line with indentation (like the bash script)
const format1 = `{
  "deviceId": "${deviceId}",
  "challenge": "${challenge}"
}`;

// Format 2: Compact without whitespace (like JSON.stringify)
const format2 = JSON.stringify({ deviceId, challenge });

// Format 3: Deterministic ordering (JSON.stringify with null, 0)
const format3 = JSON.stringify({ deviceId, challenge }, null, 0);

// Format 4: Different property order
const format4 = JSON.stringify({ challenge, deviceId });

// Write files with different formats
fs.writeFileSync(path.join(testDir, 'format1.json'), format1);
fs.writeFileSync(path.join(testDir, 'format2.json'), format2);
fs.writeFileSync(path.join(testDir, 'format3.json'), format3);
fs.writeFileSync(path.join(testDir, 'format4.json'), format4);

console.log('\nTest Data:');
console.log('Format 1 (multi-line with indentation):', format1);
console.log('Format 2 (compact):', format2);
console.log('Format 3 (deterministic):', format3);
console.log('Format 4 (different order):', format4);

// Sign each format
console.log('\nSigning different formats...');

// Function to sign and verify
const signAndVerify = (format, formatName) => {
  const signaturePath = path.join(testDir, `${formatName}.sig`);
  
  // Sign using OpenSSL
  const formatPath = path.join(testDir, `${formatName}.json`);
  execSync(`openssl dgst -sha256 -sign ${privateKeyPath} -out ${signaturePath} ${formatPath}`);
  
  // Convert signature to base64
  const signatureBin = fs.readFileSync(signaturePath);
  const signatureBase64 = signatureBin.toString('base64');
  
  console.log(`\n${formatName} Signature:`, signatureBase64.substring(0, 40) + '...');
  
  // Verify with each format
  const formats = [
    { data: format1, name: 'format1' },
    { data: format2, name: 'format2' },
    { data: format3, name: 'format3' },
    { data: format4, name: 'format4' }
  ];
  
  console.log(`Verifying ${formatName} signature with different formats:`);
  
  formats.forEach(({ data, name }) => {
    // Using Node.js crypto
    try {
      const verifier = crypto.createVerify('SHA256');
      verifier.update(data);
      const result = verifier.verify(fs.readFileSync(publicKeyPath), signatureBin);
      console.log(`  - ${name}: ${result ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      console.log(`  - ${name}: ERROR - ${error.message}`);
    }
  });
};

// Test each format
['format1', 'format2', 'format3', 'format4'].forEach(formatName => {
  const formatData = fs.readFileSync(path.join(testDir, `${formatName}.json`), 'utf8');
  signAndVerify(formatData, formatName);
});

console.log('\nTest files saved in:', testDir);