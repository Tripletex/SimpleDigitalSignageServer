#!/usr/bin/env node

/**
 * Simplified Device Registration Test (No Express, direct Sequelize calls)
 * 
 * This script tests the device registration process by directly calling 
 * the database functions, bypassing the HTTP endpoints.
 * 
 * This is useful for isolating database issues vs API issues.
 */

require('dotenv').config();
const fs = require('fs');
const { execSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

// ANSI colors for better readability
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

async function main() {
  console.log(`${colors.blue}Simplified Device Registration Test (Bypassing HTTP)${colors.reset}\n`);
  
  try {
    // Step 1: Import database models and initialize
    console.log(`${colors.yellow}Step 1: Initializing database connection...${colors.reset}`);
    
    const sequelize = require('../dist/config/database').default;
    const { Device, DeviceRegistration } = require('../dist/models');
    
    // Test database connection
    try {
      await sequelize.authenticate();
      console.log(`${colors.green}Database connection established successfully${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}Database connection failed:${colors.reset}`, error);
      process.exit(1);
    }
    
    // Step 2: Generate RSA key pair
    console.log(`\n${colors.yellow}Step 2: Generating RSA key pair...${colors.reset}`);
    
    // Generate private key
    execSync('openssl genrsa -out direct_test_private_key.pem 2048');
    
    // Generate public key
    execSync('openssl rsa -in direct_test_private_key.pem -pubout -out direct_test_public_key.pem');
    
    // Read keys
    const publicKey = fs.readFileSync('direct_test_public_key.pem', 'utf8');
    const publicKeyBase64 = Buffer.from(publicKey).toString('base64');
    
    console.log(`${colors.green}Key pair generated successfully${colors.reset}`);
    console.log(`Public key length: ${publicKeyBase64.length} characters`);
    console.log(`Public key (first 40 chars): ${publicKeyBase64.substring(0, 40)}...`);
    
    // Step 3: Directly create device and device registration
    console.log(`\n${colors.yellow}Step 3: Creating device and registration in database...${colors.reset}`);
    
    // Direct database approach (no HTTP)
    try {
      // Begin a transaction
      const transaction = await sequelize.transaction();
      
      try {
        // Generate a unique device ID
        const deviceId = uuidv4();
        console.log(`Generated device ID: ${deviceId}`);
        
        // Create device
        const device = await Device.create({
          id: deviceId,
          name: `Direct-Test-${deviceId.substring(0, 8)}`
        }, { transaction });
        
        console.log(`Created device with ID: ${device.id}`);
        
        // Create device registration
        const registration = await DeviceRegistration.create({
          id: uuidv4(),
          deviceId: deviceId,
          deviceType: 'direct-test-device',
          hardwareId: uuidv4(),
          publicKey: publicKeyBase64,
          registrationTime: new Date(),
          lastSeen: new Date(),
          active: true
        }, { transaction });
        
        console.log(`Created registration with ID: ${registration.id}`);
        
        // Commit the transaction
        await transaction.commit();
        
        console.log(`${colors.green}Device registered successfully!${colors.reset}`);
        console.log(`Device ID: ${deviceId}`);
        
        // Step 4: Verify the device was created
        console.log(`\n${colors.yellow}Step 4: Verifying device was created...${colors.reset}`);
        
        // Query the database to make sure the device exists
        const verifyDevice = await Device.findByPk(deviceId, {
          include: [DeviceRegistration]
        });
        
        if (verifyDevice) {
          console.log(`${colors.green}Device verified in database${colors.reset}`);
          console.log(`Device ID: ${verifyDevice.id}`);
          console.log(`Device Name: ${verifyDevice.name}`);
          console.log(`Registration count: ${verifyDevice.registrations?.length || 0}`);
          
          if (verifyDevice.registrations && verifyDevice.registrations.length > 0) {
            const reg = verifyDevice.registrations[0];
            console.log(`Registration ID: ${reg.id}`);
            console.log(`Public key length in DB: ${reg.publicKey.length} characters`);
          } else {
            console.log(`${colors.red}No registrations found for device${colors.reset}`);
          }
        } else {
          console.log(`${colors.red}Failed to verify device in database${colors.reset}`);
        }
        
      } catch (error) {
        // Rollback transaction on error
        await transaction.rollback();
        throw error;
      }
      
    } catch (error) {
      console.error(`${colors.red}Error creating device:${colors.reset}`, error);
      process.exit(1);
    }
    
    console.log(`\n${colors.green}Test completed successfully!${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
    process.exit(1);
  } finally {
    // Clean up
    process.exit(0);
  }
}

// Run the main function
main();