#!/usr/bin/env node

/**
 * Test script to check server health endpoint
 */
const http = require('http');

// Configuration
const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/health',
  method: 'GET'
};

console.log(`Testing health endpoint at http://${options.hostname}:${options.port}${options.path}`);

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

req.end();