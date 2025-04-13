/**
 * Simple test script for device registration
 */
const fetch = require('node-fetch');
const fs = require('fs');
const { execSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const SERVER_URL = 'http://localhost:4000';
const REGISTER_ENDPOINT = '/api/device/register';

// ANSI colors for better readability
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RED = '\x1b[31m';
const NC = '\x1b[0m'; // No Color

async function main() {
  console.log(`${BLUE}Simple device registration test${NC}`);
  
  // Generate keys
  console.log(`${YELLOW}Generating RSA key pair...${NC}`);
  
  try {
    // Generate private key
    execSync('openssl genrsa -out test_private_key.pem 2048');
    
    // Generate public key
    execSync('openssl rsa -in test_private_key.pem -pubout -out test_public_key.pem');
    
    console.log(`${GREEN}Key pair generated successfully${NC}`);
  } catch (error) {
    console.error(`${RED}Error generating keys:${NC}`, error);
    process.exit(1);
  }
  
  // Read keys
  const privateKey = fs.readFileSync('test_private_key.pem', 'utf8');
  const publicKey = fs.readFileSync('test_public_key.pem', 'utf8');
  
  // Convert public key to base64
  const publicKeyBase64 = Buffer.from(publicKey).toString('base64');
  
  console.log(`${BLUE}Public key length: ${publicKeyBase64.length} characters${NC}`);
  console.log(`${BLUE}First 40 chars of public key:${NC} ${publicKeyBase64.substring(0, 40)}...`);
  
  // Construct registration request
  const registrationRequest = {
    deviceType: 'test-device',
    hardwareId: uuidv4(),
    publicKey: publicKeyBase64
  };
  
  console.log(`${YELLOW}Sending registration request to ${SERVER_URL}${REGISTER_ENDPOINT}...${NC}`);
  
  try {
    const response = await fetch(`${SERVER_URL}${REGISTER_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(registrationRequest)
    });
    
    const text = await response.text();
    
    console.log(`${BLUE}Response status:${NC} ${response.status}`);
    console.log(`${BLUE}Response headers:${NC}`, response.headers);
    
    try {
      // Try to parse as JSON
      const jsonResponse = JSON.parse(text);
      console.log(`${GREEN}Registration successful:${NC}`, jsonResponse);
      
      if (jsonResponse.id) {
        console.log(`${GREEN}Device registered with ID:${NC} ${jsonResponse.id}`);
      } else {
        console.log(`${RED}No device ID in response${NC}`);
      }
    } catch (e) {
      // Not JSON, just show text
      console.log(`${RED}Raw response (not JSON):${NC}`, text);
    }
    
  } catch (error) {
    console.error(`${RED}Error sending registration request:${NC}`, error);
  }
}

main().catch(error => {
  console.error(`${RED}Unhandled error:${NC}`, error);
});