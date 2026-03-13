#!/usr/bin/env node

/**
 * Test script to verify a signature created by a bash script
 * 
 * This directly reads the challenge data and signature files
 * created by the device-ping-test.sh script and verifies the signature
 * using the same methods as the server.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// ANSI colors for better output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

console.log(`${colors.blue}Direct Signature Verification Test${colors.reset}`);
console.log('-'.repeat(50));

// Read files created by device-ping-test.sh
const dataPath = path.resolve(process.cwd(), 'challenge_data.json');
const signaturePath = path.resolve(process.cwd(), 'signature.bin');
const publicKeyPath = path.resolve(process.cwd(), 'device_public_key.pem');

if (!fs.existsSync(dataPath)) {
  console.error(`${colors.red}Error: ${dataPath} not found${colors.reset}`);
  console.error('Run device-ping-test.sh first to create the files');
  process.exit(1);
}

if (!fs.existsSync(signaturePath)) {
  console.error(`${colors.red}Error: ${signaturePath} not found${colors.reset}`);
  console.error('Run device-ping-test.sh first to create the files');
  process.exit(1);
}

if (!fs.existsSync(publicKeyPath)) {
  console.error(`${colors.red}Error: ${publicKeyPath} not found${colors.reset}`);
  console.error('Run device-ping-test.sh first to create the files');
  process.exit(1);
}

// Read files
const data = fs.readFileSync(dataPath, 'utf8');
const signature = fs.readFileSync(signaturePath);
const publicKey = fs.readFileSync(publicKeyPath, 'utf8');

// Log file information
console.log(`${colors.yellow}Input Files:${colors.reset}`);
console.log(`- Data file: ${colors.blue}${dataPath}${colors.reset}`);
console.log(`- Data: ${colors.blue}${data}${colors.reset}`);
console.log(`- Signature file: ${colors.blue}${signaturePath}${colors.reset}`);
console.log(`- Signature size: ${colors.blue}${signature.length} bytes${colors.reset}`);
console.log(`- Public key file: ${colors.blue}${publicKeyPath}${colors.reset}`);

// Convert signature to base64 for debugging
const signatureBase64 = signature.toString('base64');
console.log(`- Base64 signature (first 40 chars): ${colors.blue}${signatureBase64.substring(0, 40)}...${colors.reset}`);

// Try multiple verification methods
console.log(`\n${colors.yellow}Verification Results:${colors.reset}`);

// Try with Node.js crypto
try {
  const verifier = crypto.createVerify('SHA256');
  verifier.update(data);
  const nodeResult = verifier.verify(publicKey, signature);
  
  console.log(`- Node.js crypto (SHA256): ${nodeResult ? colors.green + 'SUCCESS' : colors.red + 'FAILED'}${colors.reset}`);
} catch (error) {
  console.log(`- Node.js crypto (SHA256): ${colors.red}ERROR - ${error.message}${colors.reset}`);
}

// Try with Node.js crypto (SHA-256)
try {
  const verifier = crypto.createVerify('SHA-256');
  verifier.update(data);
  const nodeResultHyphen = verifier.verify(publicKey, signature);
  
  console.log(`- Node.js crypto (SHA-256): ${nodeResultHyphen ? colors.green + 'SUCCESS' : colors.red + 'FAILED'}${colors.reset}`);
} catch (error) {
  console.log(`- Node.js crypto (SHA-256): ${colors.red}ERROR - ${error.message}${colors.reset}`);
}

// Try with direct crypto.verify method
try {
  const publicKeyObj = crypto.createPublicKey(publicKey);
  const directResult = crypto.verify(
    'SHA256',
    Buffer.from(data),
    {
      key: publicKeyObj,
      padding: crypto.constants.RSA_PKCS1_PADDING
    },
    signature
  );
  
  console.log(`- Direct crypto.verify: ${directResult ? colors.green + 'SUCCESS' : colors.red + 'FAILED'}${colors.reset}`);
} catch (error) {
  console.log(`- Direct crypto.verify: ${colors.red}ERROR - ${error.message}${colors.reset}`);
}

// Test once more with OpenSSL
try {
  const { execSync } = require('child_process');
  const opensslResult = execSync(
    `openssl dgst -sha256 -verify ${publicKeyPath} -signature ${signaturePath} ${dataPath}`
  ).toString().trim();
  
  console.log(`- OpenSSL: ${opensslResult.includes('Verified OK') ? colors.green + 'SUCCESS' : colors.red + 'FAILED'}${colors.reset}`);
} catch (error) {
  console.log(`- OpenSSL: ${colors.red}ERROR - ${error.message}${colors.reset}`);
}

// Now let's test with the server's actual implementation
console.log(`\n${colors.yellow}Testing with deviceAuth.js implementation:${colors.reset}`);

// Import the utility function (using require hack to handle TypeScript)
try {
  // Create a temporary JavaScript version
  const utilPath = path.resolve(process.cwd(), 'build/server/src/utils/deviceAuth.js');
  
  if (fs.existsSync(utilPath)) {
    // Require the module
    const deviceAuth = require('../build/server/src/utils/deviceAuth');
    
    if (deviceAuth && typeof deviceAuth.verifyDeviceSignature === 'function') {
      // Test with the function
      const result = deviceAuth.verifyDeviceSignature(
        data,
        signatureBase64,
        publicKey
      );
      
      console.log(`- Server implementation: ${result ? colors.green + 'SUCCESS' : colors.red + 'FAILED'}${colors.reset}`);
    } else {
      console.log(`${colors.red}Error: verifyDeviceSignature function not found in the module${colors.reset}`);
    }
  } else {
    console.log(`${colors.red}Error: ${utilPath} not found${colors.reset}`);
    console.log('Make sure the server has been built with TypeScript');
  }
} catch (error) {
  console.log(`${colors.red}Error loading deviceAuth module: ${error.message}${colors.reset}`);
  console.log(`Stack trace: ${error.stack}`);
}