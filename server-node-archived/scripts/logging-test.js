#!/usr/bin/env node

/**
 * Test script to check server logging
 * 
 * This script tests if the server is properly logging requests
 * and writes its own logs to a file for comparison.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const SERVER_HOST = 'localhost';
const SERVER_PORT = 4000;
const LOG_FILE = path.join(__dirname, 'test-logs.txt');

// Set up logging
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Clear the log file
fs.writeFileSync(LOG_FILE, '--- Logging Test Started ---\n');
log('Test script started');

/**
 * Make a test request to the server
 */
function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    log(`Making ${method} request to ${path}`);
    
    const options = {
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Header': 'logging-test',
        'User-Agent': 'LoggingTest/1.0'
      }
    };
    
    const req = http.request(options, (res) => {
      log(`Received response: Status ${res.statusCode}`);
      
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        log(`Response completed, ${responseData.length} bytes received`);
        try {
          const parsed = responseData ? JSON.parse(responseData) : {};
          resolve({ statusCode: res.statusCode, data: parsed });
        } catch (e) {
          log(`Error parsing response: ${e.message}`);
          resolve({ 
            statusCode: res.statusCode, 
            data: responseData,
            error: 'Invalid JSON' 
          });
        }
      });
    });
    
    req.on('error', (error) => {
      log(`Request error: ${error.message}`);
      reject(error);
    });
    
    if (data) {
      const dataString = JSON.stringify(data);
      log(`Request body: ${dataString}`);
      req.write(dataString);
    }
    
    req.end();
    log('Request sent');
  });
}

/**
 * Run a series of test requests
 */
async function runTests() {
  log('Starting tests');
  
  try {
    // Test 1: Simple GET request
    log('\n=== Test 1: Simple GET request ===');
    await makeRequest('/api/health');
    
    // Test 2: POST to device-auth/challenge
    log('\n=== Test 2: POST to device-auth/challenge ===');
    const challengeData = { deviceId: '00000000-0000-0000-0000-000000000000' };
    await makeRequest('/api/device-auth/challenge', 'POST', challengeData);
    
    log('\nAll tests completed');
    
  } catch (error) {
    log(`Error during tests: ${error.message}`);
  }
}

log('Starting test sequence');
runTests().then(() => {
  log('Test script finished');
  console.log(`Logs written to: ${LOG_FILE}`);
});