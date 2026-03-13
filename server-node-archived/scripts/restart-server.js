#!/usr/bin/env node

/**
 * Script to restart the server
 * 
 * This script checks for running server processes,
 * kills them, and starts a new server instance.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Log the current time
console.log(`Server restart initiated at ${new Date().toISOString()}`);

// Function to find all server processes
function findServerProcesses() {
  try {
    const output = execSync('ps aux | grep "ts-node src/server.ts" | grep -v grep').toString();
    const lines = output.trim().split('\n');
    
    return lines.map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        pid: parts[1],
        command: line.substring(line.indexOf('node'))
      };
    });
  } catch (error) {
    // No processes found
    return [];
  }
}

// Kill a process by PID
function killProcess(pid) {
  try {
    console.log(`Killing process ${pid}...`);
    execSync(`kill -9 ${pid}`);
    return true;
  } catch (error) {
    console.error(`Error killing process ${pid}:`, error.message);
    return false;
  }
}

// Start a new server
function startServer() {
  try {
    console.log('Starting new server instance...');
    
    // First, compile TypeScript
    console.log('Compiling TypeScript...');
    execSync('npx tsc', { stdio: 'inherit' });
    
    // Start the server using nodemon
    console.log('Starting server with nodemon...');
    const serverProcess = require('child_process').spawn(
      'npx', 
      ['nodemon', '--exec', 'ts-node', 'src/server.ts'],
      {
        detached: true,
        stdio: 'ignore',
        cwd: path.resolve(__dirname, '..')
      }
    );
    
    // Detach the process
    serverProcess.unref();
    
    console.log('Server started in background.');
    return true;
  } catch (error) {
    console.error('Error starting server:', error.message);
    return false;
  }
}

// Main function
function main() {
  // Find server processes
  const processes = findServerProcesses();
  console.log(`Found ${processes.length} server processes`);
  
  // Kill all server processes
  let killedCount = 0;
  for (const process of processes) {
    if (killProcess(process.pid)) {
      killedCount++;
    }
  }
  console.log(`Killed ${killedCount} processes`);
  
  // Start new server
  if (startServer()) {
    console.log('Server restarted successfully!');
  } else {
    console.error('Failed to restart server.');
  }
}

main();