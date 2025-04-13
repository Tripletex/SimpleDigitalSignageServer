#!/usr/bin/env node

/**
 * Script to check database structure and test device registration
 */
require('dotenv').config();
const { Sequelize } = require('sequelize');

async function main() {
  console.log('Database check starting...');
  
  // Create Sequelize instance using environment variables
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'signage',
    password: process.env.DB_PASSWORD || 'signage',
    database: process.env.DB_NAME || 'signage',
  };
  
  console.log('Using database connection:', {
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    database: dbConfig.database
  });
  
  const sequelize = new Sequelize({
    dialect: 'postgres',
    host: dbConfig.host,
    port: dbConfig.port,
    username: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    logging: false
  });
  
  try {
    // Test connection
    await sequelize.authenticate();
    console.log('Database connection successful');
    
    // Check for tables
    const [tables] = await sequelize.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\nDatabase tables:');
    tables.forEach(table => {
      console.log(`- ${table.table_name}`);
    });
    
    // Check if device_auth_challenges table exists
    const challengesTable = tables.find(t => t.table_name === 'device_auth_challenges');
    
    if (!challengesTable) {
      console.log('\n⚠️ ERROR: device_auth_challenges table does not exist!');
      console.log('This table is required for device authentication to work.');
      console.log('The server needs to be restarted with proper database sync.');
    } else {
      // Check device_auth_challenges table structure
      const [columns] = await sequelize.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'device_auth_challenges'
        ORDER BY ordinal_position
      `);
      
      console.log('\ndevice_auth_challenges table structure:');
      columns.forEach(column => {
        console.log(`- ${column.column_name}: ${column.data_type} (${column.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
      
      // Check if there are any records
      const [challengeCount] = await sequelize.query(`
        SELECT COUNT(*) as count FROM device_auth_challenges
      `);
      
      console.log(`\nTotal challenge records: ${challengeCount[0].count}`);
    }
    
    // Check if test device exists
    const [devices] = await sequelize.query(`
      SELECT id, name FROM devices WHERE id = 'test-device-id' OR name LIKE 'test%'
    `);
    
    console.log('\nTest devices:');
    if (devices.length === 0) {
      console.log('No test devices found');
    } else {
      devices.forEach(device => {
        console.log(`- ${device.id}: ${device.name}`);
      });
    }
    
    // Check device registrations
    const [registrations] = await sequelize.query(`
      SELECT dr.device_id, d.name, dr.active
      FROM device_registrations dr
      JOIN devices d ON dr.device_id = d.id
      LIMIT 10
    `);
    
    console.log('\nDevice registrations:');
    if (registrations.length === 0) {
      console.log('No device registrations found');
    } else {
      registrations.forEach(reg => {
        console.log(`- Device: ${reg.name} (${reg.device_id}), Active: ${reg.active}`);
      });
    }
    
  } catch (error) {
    console.error('Database error:', error.message);
    if (error.original) {
      console.error('Original error:', error.original);
    }
  } finally {
    await sequelize.close();
    console.log('\nDatabase connection closed');
  }
}

main().catch(error => {
  console.error('Unhandled error:', error);
});