#!/usr/bin/env node

/**
 * Signature Verification Test
 * 
 * This script tests the verification of signatures created by the device-ping-test.sh script.
 * It manually verifies signatures using multiple approaches to help diagnose issues.
 * 
 * Usage: 
 *   node verify-signature.js <data_file> <signature_file> <public_key_file>
 * 
 * Example: 
 *   node verify-signature.js challenge_data.json signature.bin device_public_key.pem
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// ANSI colors for better readability
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error(`${colors.red}Error: Missing required arguments${colors.reset}`);
  console.log(`Usage: node verify-signature.js <data_file> <signature_file> <public_key_file>`);
  process.exit(1);
}

const dataFile = args[0];
const signatureFile = args[1];
const publicKeyFile = args[2];

// Check if files exist
if (!fs.existsSync(dataFile)) {
  console.error(`${colors.red}Error: Data file '${dataFile}' not found${colors.reset}`);
  process.exit(1);
}

if (!fs.existsSync(signatureFile)) {
  console.error(`${colors.red}Error: Signature file '${signatureFile}' not found${colors.reset}`);
  process.exit(1);
}

if (!fs.existsSync(publicKeyFile)) {
  console.error(`${colors.red}Error: Public key file '${publicKeyFile}' not found${colors.reset}`);
  process.exit(1);
}

// Read files
console.log(`${colors.blue}Reading files...${colors.reset}`);
const data = fs.readFileSync(dataFile, 'utf8');
const signature = fs.readFileSync(signatureFile);
const publicKey = fs.readFileSync(publicKeyFile, 'utf8');

// Display file info
console.log(`${colors.yellow}File Information:${colors.reset}`);
console.log(`- Data file: ${colors.cyan}${dataFile}${colors.reset}`);
console.log(`- Data length: ${colors.cyan}${data.length} bytes${colors.reset}`);
console.log(`- Data: ${colors.cyan}${data.length > 80 ? data.substring(0, 80) + '...' : data}${colors.reset}`);
console.log(`- Signature file: ${colors.cyan}${signatureFile}${colors.reset}`);
console.log(`- Signature length: ${colors.cyan}${signature.length} bytes${colors.reset}`);
console.log(`- Public key file: ${colors.cyan}${publicKeyFile}${colors.reset}`);
console.log(`- Public key type: ${colors.cyan}${publicKey.includes('BEGIN PUBLIC KEY') ? 'PEM format' : 'Unknown format'}${colors.reset}`);

// Convert signature to base64 for debugging
const signatureBase64 = signature.toString('base64');
console.log(`- Base64 signature (first 40 chars): ${colors.cyan}${signatureBase64.substring(0, 40)}...${colors.reset}`);

// Create debug directory
const debugDir = path.join(process.cwd(), 'signature-debug');
if (!fs.existsSync(debugDir)) {
  fs.mkdirSync(debugDir, { recursive: true });
}

// Save base64 signature for debugging
fs.writeFileSync(path.join(debugDir, 'debug-signature.base64'), signatureBase64);

console.log(`\n${colors.yellow}Verifying Signature Using Multiple Methods:${colors.reset}`);

// Define verification methods
const verifyMethods = [
  {
    name: 'OpenSSL style (SHA256)',
    verify: () => {
      const verifier = crypto.createVerify('SHA256');
      verifier.update(data);
      return verifier.verify(publicKey, signature);
    }
  },
  {
    name: 'OpenSSL style (SHA-256 with hyphen)',
    verify: () => {
      const verifier = crypto.createVerify('SHA-256');
      verifier.update(data);
      return verifier.verify(publicKey, signature);
    }
  },
  {
    name: 'Direct crypto.verify with padding',
    verify: () => {
      const publicKeyObj = crypto.createPublicKey(publicKey);
      return crypto.verify(
        'SHA256',
        Buffer.from(data),
        {
          key: publicKeyObj,
          padding: crypto.constants.RSA_PKCS1_PADDING
        },
        signature
      );
    }
  },
  {
    name: 'RSA-SHA256',
    verify: () => {
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(data);
      return verifier.verify(publicKey, signature);
    }
  },
  {
    name: 'Binary data mode',
    verify: () => {
      const verifier = crypto.createVerify('SHA256');
      verifier.update(Buffer.from(data));
      return verifier.verify(publicKey, signature);
    }
  }
];

// Test each method
let anySuccess = false;
const results = [];

for (const method of verifyMethods) {
  try {
    console.log(`- Testing method: ${colors.cyan}${method.name}${colors.reset}`);
    const result = method.verify();
    
    if (result) {
      console.log(`  ${colors.green}✅ SUCCESS${colors.reset}`);
      anySuccess = true;
    } else {
      console.log(`  ${colors.red}❌ FAILED${colors.reset}`);
    }
    
    results.push({ method: method.name, result });
  } catch (error) {
    console.log(`  ${colors.red}❌ ERROR: ${error.message}${colors.reset}`);
    results.push({ method: method.name, error: error.message });
  }
}

// Save results to debug file
fs.writeFileSync(
  path.join(debugDir, 'verification-results.json'),
  JSON.stringify(results, null, 2)
);

// Summary
console.log(`\n${colors.yellow}Summary:${colors.reset}`);
if (anySuccess) {
  console.log(`${colors.green}Signature verification SUCCESSFUL with at least one method${colors.reset}`);
  console.log(`This means the signature is valid, but your server might be using a different verification method.`);
} else {
  console.log(`${colors.red}Signature verification FAILED with all methods${colors.reset}`);
  console.log(`This indicates a problem with either the signature, the data, or the public key.`);
}

console.log(`\n${colors.yellow}Debugging Info:${colors.reset}`);
console.log(`- Debug files saved to: ${colors.cyan}${debugDir}${colors.reset}`);
console.log(`- Check verification-results.json for detailed results`);

// Execute OpenSSL for comparison
console.log(`\n${colors.yellow}Running Direct OpenSSL Verification:${colors.reset}`);
const { spawnSync } = require('child_process');
const openssl = spawnSync('openssl', [
  'dgst', 
  '-sha256', 
  '-verify', 
  publicKeyFile, 
  '-signature', 
  signatureFile, 
  dataFile
]);

if (openssl.status === 0) {
  console.log(`${colors.green}OpenSSL verification SUCCESS${colors.reset}`);
  console.log(`This confirms your signature is valid according to OpenSSL.`);
} else {
  console.log(`${colors.red}OpenSSL verification FAILED${colors.reset}`);
  console.log(`Error: ${openssl.stderr.toString()}`);
}

// Create a new key and signature from scratch as a reference test
console.log(`\n${colors.yellow}Creating Reference Test Data:${colors.reset}`);

try {
  // Generate new key pair
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
  
  // Save test keys
  fs.writeFileSync(path.join(debugDir, 'test-private.pem'), privateKey);
  fs.writeFileSync(path.join(debugDir, 'test-public.pem'), publicKey);
  
  // Create test data
  const testData = `{"test":"data","timestamp":${Date.now()}}`;
  fs.writeFileSync(path.join(debugDir, 'test-data.json'), testData);
  
  // Sign data
  const sign = crypto.createSign('SHA256');
  sign.update(testData);
  const testSignature = sign.sign(privateKey);
  fs.writeFileSync(path.join(debugDir, 'test-signature.bin'), testSignature);
  
  // Verify the test signature
  const verify = crypto.createVerify('SHA256');
  verify.update(testData);
  const testResult = verify.verify(publicKey, testSignature);
  
  console.log(`Reference test result: ${testResult ? colors.green + 'SUCCESS' : colors.red + 'FAILED'}`);
  console.log(`Test files saved to debug directory`);
  
} catch (error) {
  console.log(`${colors.red}Error creating reference test: ${error.message}${colors.reset}`);
}