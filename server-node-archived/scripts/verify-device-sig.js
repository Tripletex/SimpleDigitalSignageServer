#!/usr/bin/env node

/**
 * Direct verification of OpenSSL signatures using Node.js
 * Usage: node verify-device-sig.js <path-to-data-file> <path-to-signature-file> <path-to-public-key-file>
 */

const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Get command line arguments
const dataFile = process.argv[2];
const signatureFile = process.argv[3];
const publicKeyFile = process.argv[4];

if (!dataFile || !signatureFile || !publicKeyFile) {
  console.error('Usage: node verify-device-sig.js <data-file> <signature-file> <public-key-file>');
  process.exit(1);
}

// Read files
console.log(`Reading files...`);
const data = fs.readFileSync(dataFile, 'utf8');
const signatureBin = fs.readFileSync(signatureFile);
const publicKey = fs.readFileSync(publicKeyFile, 'utf8');

console.log(`Data (${data.length} bytes):`);
console.log(data);
console.log(`\nSignature (${signatureBin.length} bytes):`);
console.log(signatureBin.slice(0, 20).toString('hex') + '...');
console.log(`\nPublic key (${publicKey.length} chars):`);
console.log(publicKey.substring(0, 100) + '...');

// Try direct verification with Node.js
console.log('\nAttempting verification with Node.js crypto...');

try {
  const verifier = crypto.createVerify('SHA256');
  verifier.update(data);
  const result = verifier.verify(publicKey, signatureBin);
  console.log(`Node.js verification result: ${result ? 'SUCCESS' : 'FAILURE'}`);
} catch (error) {
  console.error(`Node.js verification error:`, error);
}

// Try verification with OpenSSL directly
console.log('\nAttempting verification with OpenSSL command...');

try {
  // Create temporary files in the current directory
  const tmpDataFile = `./tmp-data-${Date.now()}.json`;
  const tmpSigFile = `./tmp-sig-${Date.now()}.bin`;
  
  fs.writeFileSync(tmpDataFile, data);
  fs.writeFileSync(tmpSigFile, signatureBin);
  
  try {
    const result = execSync(`openssl dgst -sha256 -verify "${publicKeyFile}" -signature "${tmpSigFile}" "${tmpDataFile}"`)
      .toString()
      .trim();
    console.log(`OpenSSL verification result: ${result}`);
  } catch (error) {
    console.error(`OpenSSL verification error:`, error.message);
  }
  
  // Clean up temp files
  fs.unlinkSync(tmpDataFile);
  fs.unlinkSync(tmpSigFile);
} catch (error) {
  console.error(`Error during OpenSSL verification:`, error);
}

// Report data hash (this should match what's signed)
console.log('\nData digest (SHA-256):');
console.log(crypto.createHash('sha256').update(data).digest('hex'));