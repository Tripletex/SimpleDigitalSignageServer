#!/usr/bin/env node

/**
 * Test the complete device authentication flow:
 * 1. Register a new device
 * 2. Request an authentication challenge
 * 3. Sign the challenge
 * 4. Verify the signature and get a token
 */
const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Configuration
const SERVER_HOST = 'localhost';
const SERVER_PORT = 4000;
const REGISTER_PATH = '/api/device/register';
const CHALLENGE_PATH = '/api/device-auth/challenge';
const VERIFY_PATH = '/api/device-auth/verify';

// Generate a key pair for the test
console.log('Generating RSA key pair...');
execSync('openssl genrsa -out test_device_private_key.pem 2048');
execSync('openssl rsa -in test_device_private_key.pem -pubout -out test_device_public_key.pem');

const privateKey = fs.readFileSync('test_device_private_key.pem', 'utf8');
const publicKey = fs.readFileSync('test_device_public_key.pem', 'utf8');
const publicKeyBase64 = Buffer.from(publicKey).toString('base64');

console.log('Key pair generated successfully.');
console.log(`Public key (first 40 chars): ${publicKeyBase64.substring(0, 40)}...`);

/**
 * Make an HTTP request
 */
async function makeRequest(path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      console.log(`STATUS: ${res.statusCode}`);
      console.log(`HEADERS: ${JSON.stringify(res.headers, null, 2)}`);
      
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${responseData}`));
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

/**
 * Sign data using the private key
 */
function signData(data) {
  // Create string data if object is provided
  const dataString = typeof data === 'string' ? data : JSON.stringify(data);
  
  // Sign with Node.js crypto
  const sign = crypto.createSign('SHA256');
  sign.update(dataString);
  const signature = sign.sign(privateKey);
  return signature.toString('base64');
}

/**
 * Run the complete auth flow
 */
async function runAuthFlow() {
  try {
    // Step 1: Register a new device
    console.log('\n=== Step 1: Register a new device ===');
    const registerData = {
      deviceType: 'test-device',
      hardwareId: uuidv4(),
      publicKey: publicKeyBase64
    };
    
    console.log(`Registering device with hardware ID: ${registerData.hardwareId}`);
    const registerResponse = await makeRequest(REGISTER_PATH, registerData);
    console.log('Register response:', JSON.stringify(registerResponse, null, 2));
    
    if (!registerResponse.id) {
      throw new Error('Failed to register device: No device ID in response');
    }
    
    const deviceId = registerResponse.id;
    console.log(`Device registered with ID: ${deviceId}`);
    
    // Step 2: Request an authentication challenge
    console.log('\n=== Step 2: Request an authentication challenge ===');
    const challengeResponse = await makeRequest(CHALLENGE_PATH, { deviceId });
    console.log('Challenge response:', JSON.stringify(challengeResponse, null, 2));
    
    if (!challengeResponse.challenge) {
      throw new Error('Failed to get challenge: No challenge in response');
    }
    
    const challenge = challengeResponse.challenge;
    console.log(`Challenge received: ${challenge}`);
    
    // Step 3: Sign the challenge
    console.log('\n=== Step 3: Sign the challenge ===');
    const dataToSign = {
      deviceId,
      challenge
    };
    console.log(`Data to sign: ${JSON.stringify(dataToSign)}`);
    
    // Sign with Node.js crypto
    const signature = signData(dataToSign);
    console.log(`Signature (first 40 chars): ${signature.substring(0, 40)}...`);
    
    // Also sign using OpenSSL for comparison
    fs.writeFileSync('challenge_data.json', JSON.stringify(dataToSign));
    execSync('openssl dgst -sha256 -sign test_device_private_key.pem -out signature.bin challenge_data.json');
    const opensslSignature = fs.readFileSync('signature.bin');
    const opensslSignatureBase64 = opensslSignature.toString('base64');
    console.log(`OpenSSL signature (first 40 chars): ${opensslSignatureBase64.substring(0, 40)}...`);
    
    // Step 4: Verify the signature
    console.log('\n=== Step 4: Verify the signature ===');
    const verifyData = {
      deviceId,
      challenge,
      signature: opensslSignatureBase64 // Use OpenSSL signature as it's more compatible
    };
    
    // Save verification request to file for debugging
    fs.writeFileSync('verify_request.json', JSON.stringify(verifyData, null, 2));
    console.log(`Verification request saved to verify_request.json`);
    console.log(`Request body length: ${JSON.stringify(verifyData).length} bytes`);
    
    // Special verbose version of makeRequest for verification
    let verifyResponse;
    try {
      console.log('Making verbose verification request to:', `${SERVER_HOST}:${SERVER_PORT}${VERIFY_PATH}`);
      
      // Create the HTTP request manually for more control
      const options = {
        hostname: SERVER_HOST,
        port: SERVER_PORT,
        path: VERIFY_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'NodeTestScript/1.0',
          'Accept': '*/*'
        }
      };
      
      const requestBody = JSON.stringify(verifyData);
      
      verifyResponse = await new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
          console.log(`Response status: ${res.statusCode}`);
          console.log(`Response headers: ${JSON.stringify(res.headers, null, 2)}`);
          
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            console.log(`Response body length: ${data.length} bytes`);
            
            try {
              const parsedData = JSON.parse(data);
              resolve(parsedData);
            } catch (e) {
              console.error('Error parsing response JSON:', e.message);
              console.log('Raw response:', data);
              reject(e);
            }
          });
        });
        
        req.on('error', (error) => {
          console.error('Request error:', error.message);
          reject(error);
        });
        
        // Write request body
        req.write(requestBody);
        req.end();
        
        console.log('Verification request sent');
      });
    } catch (error) {
      console.error('Error during verification request:', error.message);
      return false;
    }
    
    // Save response to file
    fs.writeFileSync('verify_response.json', JSON.stringify(verifyResponse, null, 2));
    console.log('Verify response saved to verify_response.json');
    
    console.log('Verify response:', JSON.stringify(verifyResponse, null, 2));
    
    if (verifyResponse && verifyResponse.token) {
      console.log(`\n✅ Authentication successful! Token received.`);
      return true;
    } else {
      console.log(`\n❌ Authentication failed: ${verifyResponse ? verifyResponse.message : 'No response'}`);
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ Error during authentication flow:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error(`Make sure the server is running on ${SERVER_HOST}:${SERVER_PORT}`);
    }
    return false;
  }
}

runAuthFlow().then(success => {
  console.log(success ? '\nAuth flow completed successfully!' : '\nAuth flow failed.');
});