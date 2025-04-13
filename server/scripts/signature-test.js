#!/usr/bin/env node

/**
 * Device Authentication Signature Test
 * 
 * This script tests the signing and verification process for device authentication.
 * It simulates the exact flow that happens between the device-ping-test.sh script
 * and the server's signature verification.
 * 
 * Run with: node signature-test.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI colors for better output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

console.log(`${colors.blue}Device Authentication Signature Test${colors.reset}`);
console.log('-'.repeat(50));

// Step 1: Generate an RSA key pair (like a device would)
console.log(`${colors.yellow}Step 1: Generating RSA key pair${colors.reset}`);

// Check if openssl is available
try {
  execSync('openssl version', { stdio: 'ignore' });
} catch (error) {
  console.error(`${colors.red}Error: OpenSSL is required but not available${colors.reset}`);
  process.exit(1);
}

// Create test directory if it doesn't exist
const testDir = path.join(__dirname, 'test-keys');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Generate private key using openssl (same as in the bash script)
const privateKeyPath = path.join(testDir, 'device_private_key.pem');
const publicKeyPath = path.join(testDir, 'device_public_key.pem');

// Generate fresh keys
execSync(`openssl genrsa -out ${privateKeyPath} 2048`);
execSync(`openssl rsa -in ${privateKeyPath} -pubout -out ${publicKeyPath}`);

console.log(`${colors.green}Key pair generated:${colors.reset}`);
console.log(`- Private key: ${privateKeyPath}`);
console.log(`- Public key: ${publicKeyPath}`);

// Read the keys
const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const publicKey = fs.readFileSync(publicKeyPath, 'utf8');

// Convert public key to base64 (like it would be stored in the database)
const publicKeyBase64 = Buffer.from(publicKey).toString('base64');
console.log(`\nPublic key (first 40 chars of base64): ${publicKeyBase64.substring(0, 40)}...`);

// Step 2: Create a test challenge
console.log(`\n${colors.yellow}Step 2: Creating test challenge${colors.reset}`);
const deviceId = 'test-device-' + Date.now();
const challenge = crypto.randomBytes(32).toString('base64');

// Create the data to sign (in exactly the same format as the bash script)
const dataToSign = JSON.stringify({ deviceId, challenge });
const dataPath = path.join(testDir, 'challenge.json');
fs.writeFileSync(dataPath, dataToSign);

console.log(`Challenge data: ${dataToSign}`);
console.log(`Data written to: ${dataPath}`);

// Step 3: Sign the challenge using OpenSSL (like the bash script would)
console.log(`\n${colors.yellow}Step 3: Signing challenge with OpenSSL${colors.reset}`);
const signaturePath = path.join(testDir, 'signature.bin');

// Sign using OpenSSL
execSync(`openssl dgst -sha256 -sign ${privateKeyPath} -out ${signaturePath} ${dataPath}`);

// Read the binary signature and convert to base64
const signatureBin = fs.readFileSync(signaturePath);
const signatureBase64 = signatureBin.toString('base64');

console.log(`Signature created with OpenSSL (first 40 chars of base64): ${signatureBase64.substring(0, 40)}...`);

// Step 4: Verify the signature using multiple methods
console.log(`\n${colors.yellow}Step 4: Verifying signature with different methods${colors.reset}`);

// Our multiple verification methods to try
const verifyMethods = [
  {
    name: 'Method 1: Standard createVerify',
    verify: () => {
      const verifier = crypto.createVerify('SHA256');
      verifier.update(dataToSign);
      return verifier.verify(publicKey, signatureBin);
    }
  },
  {
    name: 'Method 2: Direct verify with explicit padding',
    verify: () => {
      const publicKeyObj = crypto.createPublicKey(publicKey);
      return crypto.verify(
        'SHA256',
        Buffer.from(dataToSign),
        {
          key: publicKeyObj,
          padding: crypto.constants.RSA_PKCS1_PADDING
        },
        signatureBin
      );
    }
  },
  {
    name: 'Method 3: SHA-256 with hyphen',
    verify: () => {
      const verifier = crypto.createVerify('SHA-256');
      verifier.update(dataToSign);
      return verifier.verify(publicKey, signatureBin);
    }
  },
  {
    name: 'Method 4: Lowercase sha256',
    verify: () => {
      const verifier = crypto.createVerify('sha256');
      verifier.update(dataToSign);
      return verifier.verify(publicKey, signatureBin);
    }
  }
];

// Try each verification method
let anySuccess = false;

for (const method of verifyMethods) {
  try {
    const result = method.verify();
    console.log(`${method.name}: ${result ? colors.green + 'SUCCESS' : colors.red + 'FAILED'}`);
    if (result) {
      anySuccess = true;
    }
  } catch (error) {
    console.log(`${method.name}: ${colors.red}ERROR - ${error.message}${colors.reset}`);
  }
}

// Step 5: Verify with the decoded public key (like it would be in the database)
console.log(`\n${colors.yellow}Step 5: Verifying with base64-decoded public key${colors.reset}`);

// This simulates getting the key from the database and decoding it
const decodedPublicKey = Buffer.from(publicKeyBase64, 'base64').toString('utf8');

// Verify that the decoded key matches the original
console.log(`Decoded key matches original: ${decodedPublicKey.trim() === publicKey.trim() ? colors.green + 'YES' : colors.red + 'NO'}`);

// Try verification with the decoded key
try {
  const verifier = crypto.createVerify('SHA256');
  verifier.update(dataToSign);
  const result = verifier.verify(decodedPublicKey, signatureBin);
  console.log(`Verification with decoded key: ${result ? colors.green + 'SUCCESS' : colors.red + 'FAILED'}`);
} catch (error) {
  console.log(`Verification with decoded key: ${colors.red}ERROR - ${error.message}${colors.reset}`);
}

// Summary
console.log(`\n${colors.yellow}Summary:${colors.reset}`);
if (anySuccess) {
  console.log(`${colors.green}At least one verification method succeeded!${colors.reset}`);
  console.log('The signature verification system should work correctly with the OpenSSL-generated signatures.');
} else {
  console.log(`${colors.red}All verification methods failed.${colors.reset}`);
  console.log('There may be a format incompatibility between OpenSSL and Node.js crypto.');
}

// Cleanup
console.log(`\n${colors.blue}Test files saved in: ${testDir}${colors.reset}`);
console.log(`You can examine them for debugging, or remove the directory when done.`);