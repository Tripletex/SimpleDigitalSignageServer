/**
 * Device Authentication Test Utilities
 * 
 * This module provides functions to test device authentication
 * without depending on the server running.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Test parameters 
 */
const TEST_PARAMS = {
  keyDir: path.join(__dirname, 'auth-test-keys'),
  privateKeyPath: path.join(__dirname, 'auth-test-keys', 'device_private_key.pem'),
  publicKeyPath: path.join(__dirname, 'auth-test-keys', 'device_public_key.pem'),
  challengePath: path.join(__dirname, 'auth-test-keys', 'challenge.json'),
  signaturePath: path.join(__dirname, 'auth-test-keys', 'signature.bin')
};

/**
 * Generate a key pair for testing
 * @returns {Object} The generated keys in different formats
 */
function generateKeyPair() {
  console.log('Generating RSA key pair...');
  
  // Create directory if needed
  if (!fs.existsSync(TEST_PARAMS.keyDir)) {
    fs.mkdirSync(TEST_PARAMS.keyDir, { recursive: true });
  }
  
  // Generate keys using OpenSSL
  execSync(`openssl genrsa -out ${TEST_PARAMS.privateKeyPath} 2048`);
  execSync(`openssl rsa -in ${TEST_PARAMS.privateKeyPath} -pubout -out ${TEST_PARAMS.publicKeyPath}`);
  
  // Read the generated keys
  const privateKey = fs.readFileSync(TEST_PARAMS.privateKeyPath, 'utf8');
  const publicKey = fs.readFileSync(TEST_PARAMS.publicKeyPath, 'utf8');
  
  // Convert public key to base64 (as stored in the database)
  const publicKeyBase64 = Buffer.from(publicKey).toString('base64');
  
  return {
    privateKey,
    publicKey,
    publicKeyBase64
  };
}

/**
 * Generate a challenge for testing
 * @param {string} deviceId - The device ID to use
 * @returns {Object} The challenge data
 */
function generateTestChallenge(deviceId) {
  console.log('Generating challenge...');
  
  const challenge = crypto.randomBytes(32).toString('base64');
  const challengeData = { deviceId, challenge };
  const challengeJson = JSON.stringify(challengeData);
  
  // Save challenge to file
  fs.writeFileSync(TEST_PARAMS.challengePath, challengeJson);
  
  return {
    challenge,
    challengeData,
    challengeJson
  };
}

/**
 * Sign a challenge using OpenSSL (simulating a device)
 * @param {string} challengeJson - The challenge data as JSON string
 * @returns {string} The base64-encoded signature
 */
function signChallengeWithOpenSSL(challengeJson) {
  console.log('Signing challenge with OpenSSL...');
  
  // Write challenge to file if it's not already there
  if (!fs.existsSync(TEST_PARAMS.challengePath) || 
      fs.readFileSync(TEST_PARAMS.challengePath, 'utf8') !== challengeJson) {
    fs.writeFileSync(TEST_PARAMS.challengePath, challengeJson);
  }
  
  // Sign the challenge using OpenSSL (exactly as the device would)
  execSync(`openssl dgst -sha256 -sign ${TEST_PARAMS.privateKeyPath} -out ${TEST_PARAMS.signaturePath} ${TEST_PARAMS.challengePath}`);
  
  // Read the signature and convert to base64
  const signature = fs.readFileSync(TEST_PARAMS.signaturePath);
  const signatureBase64 = signature.toString('base64');
  
  return signatureBase64;
}

/**
 * Verify a signature using Node.js crypto (simulating the server)
 * @param {string} data - The data that was signed
 * @param {string} signatureBase64 - The base64-encoded signature
 * @param {string} publicKey - The public key in PEM format
 * @returns {boolean} Whether the signature is valid
 */
function verifySignature(data, signatureBase64, publicKey) {
  console.log('Verifying signature...');
  
  // Convert base64 signature to buffer
  const signatureBuffer = Buffer.from(signatureBase64, 'base64');
  
  // Try different verification methods
  const methods = [
    () => {
      const verifier = crypto.createVerify('SHA256');
      verifier.update(data);
      return verifier.verify(publicKey, signatureBuffer);
    },
    () => {
      const verifier = crypto.createVerify('SHA-256');
      verifier.update(data);
      return verifier.verify(publicKey, signatureBuffer);
    },
    () => {
      const verifier = crypto.createVerify('sha256');
      verifier.update(data);
      return verifier.verify(publicKey, signatureBuffer);
    },
    () => {
      const publicKeyObj = crypto.createPublicKey(publicKey);
      return crypto.verify('SHA256', Buffer.from(data), {
        key: publicKeyObj,
        padding: crypto.constants.RSA_PKCS1_PADDING
      }, signatureBuffer);
    }
  ];
  
  // Try each method
  for (const method of methods) {
    try {
      const result = method();
      if (result) {
        return true;
      }
    } catch (err) {
      // Continue to next method
    }
  }
  
  return false;
}

/**
 * Complete authentication flow test
 * @param {string} deviceId - The device ID to use
 * @returns {Object} Test results
 */
function testAuthenticationFlow(deviceId = `test-device-${Date.now()}`) {
  console.log(`\n---- Testing Authentication Flow for Device: ${deviceId} ----\n`);
  
  // Step 1: Generate key pair
  const keys = generateKeyPair();
  console.log(`- Generated key pair`);
  
  // Step 2: Generate challenge
  const { challengeJson, challengeData } = generateTestChallenge(deviceId);
  console.log(`- Generated challenge: ${challengeData.challenge.substring(0, 20)}...`);
  
  // Step 3: Sign challenge with OpenSSL
  const signature = signChallengeWithOpenSSL(challengeJson);
  console.log(`- Signed challenge with OpenSSL`);
  
  // Step 4: Verify signature with Node.js crypto
  const isValid = verifySignature(challengeJson, signature, keys.publicKey);
  console.log(`- Verification result: ${isValid ? 'SUCCESS' : 'FAILED'}`);
  
  // Step 5: Also verify with base64-decoded public key
  const decodedPublicKey = Buffer.from(keys.publicKeyBase64, 'base64').toString('utf8');
  const isValidDecoded = verifySignature(challengeJson, signature, decodedPublicKey);
  console.log(`- Verification with decoded key: ${isValidDecoded ? 'SUCCESS' : 'FAILED'}`);
  
  return {
    deviceId,
    keys,
    challenge: challengeData.challenge,
    signature,
    isValid,
    isValidDecoded
  };
}

// Export functions
module.exports = {
  generateKeyPair,
  generateTestChallenge,
  signChallengeWithOpenSSL,
  verifySignature,
  testAuthenticationFlow
};

// If run directly, perform a test
if (require.main === module) {
  const result = testAuthenticationFlow();
  
  console.log('\n---- Test Summary ----');
  console.log(`Device ID: ${result.deviceId}`);
  console.log(`Challenge: ${result.challenge.substring(0, 20)}...`);
  console.log(`Signature Valid: ${result.isValid ? 'YES' : 'NO'}`);
  console.log(`Decoded Key Valid: ${result.isValidDecoded ? 'YES' : 'NO'}`);
  
  if (result.isValid && result.isValidDecoded) {
    console.log('\n✅ SUCCESS: Authentication flow is working correctly!');
    console.log('Your device authentication system should now work properly.');
  } else {
    console.log('\n❌ FAILURE: Authentication verification failed.');
    console.log('There may still be issues with the implementation.');
  }
  
  console.log(`\nTest files are in: ${TEST_PARAMS.keyDir}`);
}