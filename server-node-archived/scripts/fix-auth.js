#!/usr/bin/env node

/**
 * Direct test of device authentication process
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Configuration
const deviceId = 'test-device-' + Date.now();
const workDir = path.join(__dirname, 'fix-auth-test');

// Ensure working directory exists
if (!fs.existsSync(workDir)) {
  fs.mkdirSync(workDir, { recursive: true });
}

console.log('Working directory:', workDir);
console.log('Device ID:', deviceId);

// Step 1: Generate key pair (like the client)
console.log('\nStep 1: Generating RSA key pair...');
const privateKeyPath = path.join(workDir, 'private.pem');
const publicKeyPath = path.join(workDir, 'public.pem');

execSync(`openssl genrsa -out ${privateKeyPath} 2048`);
execSync(`openssl rsa -in ${privateKeyPath} -pubout -out ${publicKeyPath}`);

// Read the keys
const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const publicKey = fs.readFileSync(publicKeyPath, 'utf8');
const publicKeyBase64 = Buffer.from(publicKey).toString('base64');

console.log('Public key (base64):', publicKeyBase64.substring(0, 40) + '...');

// Step 2: Generate a challenge (like the server)
console.log('\nStep 2: Generating challenge...');
const challenge = crypto.randomBytes(32).toString('base64');
console.log('Challenge:', challenge);

// Step 3: Create challenge data (like the client)
console.log('\nStep 3: Creating challenge data...');
const formats = [
  {
    name: 'bash_with_spaces',
    data: `{
  "deviceId": "${deviceId}",
  "challenge": "${challenge}"
}`
  },
  {
    name: 'js_compact',
    data: JSON.stringify({ deviceId, challenge })
  },
  {
    name: 'js_nonull',
    data: JSON.stringify({ deviceId, challenge }, null, 0)
  },
  {
    name: 'manual',
    data: `{"deviceId":"${deviceId}","challenge":"${challenge}"}`
  },
  {
    name: 'reversed',
    data: JSON.stringify({ challenge, deviceId })
  }
];

for (const format of formats) {
  const dataPath = path.join(workDir, `${format.name}.json`);
  fs.writeFileSync(dataPath, format.data);
  
  // Sign the data
  console.log(`\nSigning ${format.name}...`);
  const sigPath = path.join(workDir, `${format.name}.sig`);
  execSync(`openssl dgst -sha256 -sign ${privateKeyPath} -out ${sigPath} ${dataPath}`);
  
  // Read the signature
  const sigBin = fs.readFileSync(sigPath);
  const sigBase64 = sigBin.toString('base64');
  
  console.log(`${format.name} signature:`, sigBase64.substring(0, 40) + '...');
  
  // Try verifying with Node.js
  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(format.data);
    const result = verifier.verify(publicKey, sigBin);
    console.log(`Node.js verification of ${format.name}:`, result ? 'SUCCESS' : 'FAILED');
  } catch (error) {
    console.log(`Node.js verification of ${format.name} ERROR:`, error.message);
  }
  
  // Try verifying with OpenSSL
  try {
    const result = execSync(`openssl dgst -sha256 -verify ${publicKeyPath} -signature ${sigPath} ${dataPath}`).toString().trim();
    console.log(`OpenSSL verification of ${format.name}:`, result);
  } catch (error) {
    console.log(`OpenSSL verification of ${format.name} ERROR:`, error.message);
  }
}

// Create a curl test command for the user
console.log('\nTest with curl commands:');
for (const format of formats) {
  const sigPath = path.join(workDir, `${format.name}.sig`);
  const sigBase64 = fs.readFileSync(sigPath).toString('base64');
  
  const payload = {
    deviceId: deviceId,
    challenge: challenge,
    signature: sigBase64
  };
  
  const payloadPath = path.join(workDir, `${format.name}_payload.json`);
  fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2));
  
  console.log(`curl -X POST "http://localhost:4000/api/device-auth/verify" -H "Content-Type: application/json" -d @${payloadPath}`);
}