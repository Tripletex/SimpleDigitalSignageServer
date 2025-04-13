/**
 * Device Authentication Test
 * 
 * This script demonstrates the full device authentication flow:
 * 1. Register a device with the server, providing a public key
 * 2. Request an authentication challenge
 * 3. Sign the challenge with the device's private key
 * 4. Send the signed challenge to get a JWT token
 * 5. Use the JWT token to authenticate API requests
 * 
 * This follows a passwordless WebAuthn-style authentication flow
 * that's suitable for IoT and digital signage devices.
 */
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

// Configuration
const SERVER_URL = "http://localhost:4000";  // Use the actual server port
const REGISTER_ENDPOINT = "/api/device/register";
const AUTH_CHALLENGE_ENDPOINT = "/api/device-auth/challenge";
const AUTH_VERIFY_ENDPOINT = "/api/device-auth/verify";
const PING_ENDPOINT = "/api/device/ping";

// Generate a device name
const DEVICE_NAME = `test-device-${Date.now()}`;

console.log(`Starting device authentication test for ${DEVICE_NAME}...`);

// Generate key pair
console.log("Generating RSA key pair...");
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
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

// Save keys to files
fs.writeFileSync('device_private_key.pem', privateKey);
fs.writeFileSync('device_public_key.pem', publicKey);
console.log("Keys saved to files: device_private_key.pem and device_public_key.pem");

// Convert public key to base64 - this is what we'll send to the server 
// and what the server will store
console.log("Generated public key in PEM format, first 100 chars:");
console.log(publicKey.substring(0, 100) + "...");
const publicKeyBase64 = Buffer.from(publicKey).toString('base64');

// Helper function to make HTTP requests
async function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add authorization header if token is provided
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const options = {
      hostname: 'localhost',
      port: 4000,
      path,
      method,
      headers
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve(parsedData);
        } catch (e) {
          resolve(responseData);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Main execution flow
async function main() {
  try {
    // Step 1: Register device
    console.log("\nStep 1: Registering device...");
    const registrationResponse = await makeRequest('POST', REGISTER_ENDPOINT, {
      deviceType: "test-device",
      hardwareId: crypto.randomUUID(),
      publicKey: publicKeyBase64
    });
    
    console.log("Registration response:", registrationResponse);
    const deviceId = registrationResponse.id;
    if (!deviceId) {
      throw new Error("Failed to get device ID from registration response");
    }
    console.log(`Device ID: ${deviceId}`);
    
    // Step 2: Request authentication challenge
    console.log("\nStep 2: Requesting authentication challenge...");
    const challengeResponse = await makeRequest('POST', AUTH_CHALLENGE_ENDPOINT, {
      deviceId
    });
    
    console.log("Challenge response:", challengeResponse);
    const challenge = challengeResponse.challenge;
    if (!challenge) {
      throw new Error("Failed to get challenge from response");
    }
    
    // Step 3: Sign the challenge
    console.log("\nStep 3: Signing the challenge...");
    const dataToSign = JSON.stringify({
      deviceId,
      challenge
    });
    
    console.log("Data to sign:", dataToSign);
    
    // Create signature using private key
    const sign = crypto.createSign('SHA256');
    sign.update(dataToSign);
    const signature = sign.sign(privateKey);
    const signatureBase64 = signature.toString('base64');
    
    // Also save the signature and data to files for manual testing if needed
    fs.writeFileSync('js_data_to_sign.json', dataToSign);
    fs.writeFileSync('js_signature.bin', signature);
    fs.writeFileSync('js_signature_base64.txt', signatureBase64);
    
    console.log(`Signature created (first 20 chars): ${signatureBase64.substring(0, 20)}...`);
    
    // Step 4: Verify the challenge
    console.log("\nStep 4: Verifying challenge to get token...");
    const verifyResponse = await makeRequest('POST', AUTH_VERIFY_ENDPOINT, {
      deviceId,
      challenge,
      signature: signatureBase64
    });
    
    console.log("Verification response:", verifyResponse);
    
    if (!verifyResponse.token) {
      throw new Error("Failed to get token");
    }
    
    const token = verifyResponse.token;
    console.log(`Received token (first 20 chars): ${token.substring(0, 20)}...`);
    
    // Step 5: Test the token with a ping
    console.log("\nStep 5: Testing token with device ping...");
    const pingResponse = await makeRequest('POST', PING_ENDPOINT, {
      id: deviceId,
      name: DEVICE_NAME,
      networks: [
        {
          name: "eth0",
          ipAddress: ["192.168.1.100"]
        }
      ]
    }, token);
    
    console.log("Ping response:", pingResponse);
    console.log("\nTest completed successfully!");
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// Run the test
main();