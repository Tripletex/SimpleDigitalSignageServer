#!/usr/bin/env node

/**
 * Test the device auth endpoints
 */
const http = require('http');
const { v4: uuidv4 } = require('uuid');

// Configuration
const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/device-auth/challenge',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

// Use a known registered device ID
const deviceId = '1057f416-c8a9-4d3a-a820-0016b6a0758f'; // Previously registered device
console.log(`Testing device-auth challenge endpoint with registered device ID: ${deviceId}`);

// Create the request
const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers, null, 2)}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('RESPONSE BODY:');
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log(data);
    }
  });
});

req.on('error', (e) => {
  console.error(`PROBLEM: ${e.message}`);
});

// Write the request body
const requestBody = JSON.stringify({
  deviceId: deviceId
});

req.write(requestBody);
req.end();