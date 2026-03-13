#!/usr/bin/env node

/**
 * Simple script to test an endpoint
 */
const http = require('http');

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

const requestData = JSON.stringify({
  deviceId: 'test-device-id'
});

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
  
  if (e.code === 'ECONNREFUSED') {
    console.error('The server is not running or is not listening on the specified port.');
  }
});

// Write the request body
req.write(requestData);
req.end();

console.log(`Sending request to ${options.hostname}:${options.port}${options.path}`);
console.log(`Request data: ${requestData}`);