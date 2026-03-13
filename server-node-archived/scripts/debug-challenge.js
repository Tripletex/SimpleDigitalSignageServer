#!/usr/bin/env node

/**
 * Debug script to compare exact challenge data formats
 * 
 * Usage:
 * 1. Get the deviceId and challenge from the test script output
 * 2. Run this script with those values:
 *    node debug-challenge.js deviceId challenge
 */

const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Get args from command line
const deviceId = process.argv[2];
const challenge = process.argv[3];

if (!deviceId || !challenge) {
  console.error('Usage: node debug-challenge.js deviceId challenge');
  process.exit(1);
}

console.log('Using deviceId:', deviceId);
console.log('Using challenge:', challenge);

// Create a temp directory
const tempDir = './debug-challenge';
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Generate a private key for testing
const privateKeyPath = `${tempDir}/private_key.pem`;
const publicKeyPath = `${tempDir}/public_key.pem`;

execSync(`openssl genrsa -out ${privateKeyPath} 2048`);
execSync(`openssl rsa -in ${privateKeyPath} -pubout -out ${publicKeyPath}`);

// Create the data in various formats
const formats = {
  'bash_format': `{
  "deviceId": "${deviceId}",
  "challenge": "${challenge}"
}`,
  'compact_json': JSON.stringify({ deviceId, challenge }),
  'compact_with_null': JSON.stringify({ deviceId, challenge }, null, 0),
  'manual_format': `{"deviceId":"${deviceId}","challenge":"${challenge}"}`,
  'altered_order': JSON.stringify({ challenge, deviceId })
};

// Save each format and sign it
for (const [name, format] of Object.entries(formats)) {
  const formatPath = `${tempDir}/${name}.json`;
  fs.writeFileSync(formatPath, format);
  console.log(`\n== ${name} ==`);
  console.log('Content:', format);
  
  // Sign with OpenSSL
  const sigPath = `${tempDir}/${name}.sig`;
  execSync(`openssl dgst -sha256 -sign ${privateKeyPath} -out ${sigPath} ${formatPath}`);
  
  // Convert to base64
  const signature = fs.readFileSync(sigPath).toString('base64');
  console.log('Signature (first 40 chars):', signature.substring(0, 40) + '...');
  
  // Create verification payload
  const payload = JSON.stringify({
    deviceId: deviceId,
    challenge: challenge,
    signature: signature
  }, null, 2);
  
  fs.writeFileSync(`${tempDir}/${name}_payload.json`, payload);
}

console.log(`\nDebug files saved to: ${tempDir}`);
console.log(`\nIn another terminal, try verifying each signature with the server using curl:`);
console.log(`curl -X POST "http://localhost:4000/api/device-auth/verify" -H "Content-Type: application/json" -d @${tempDir}/compact_json_payload.json`);
console.log(`curl -X POST "http://localhost:4000/api/device-auth/verify" -H "Content-Type: application/json" -d @${tempDir}/manual_format_payload.json`);