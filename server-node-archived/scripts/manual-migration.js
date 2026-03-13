/**
 * Manual migration script to fix device relations
 */
const { Pool } = require('pg');

// Create a connection using the same config as the application
const pool = new Pool({
  user: process.env.DB_USER || 'signage',
  password: process.env.DB_PASSWORD || 'signage',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'signage',
  port: parseInt(process.env.DB_PORT || '5432')
});

async function executeQuery(query, params = []) {
  try {
    console.log('Executing query:', query, params);
    const result = await pool.query(query, params);
    console.log('Result:', result.rowCount, 'rows affected');
    return result;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

async function runMigration() {
  try {
    console.log('Starting manual migration...');
    
    // Check if tables exist
    const tables = ['device_registrations', 'device_auth_challenges'];
    for (const table of tables) {
      const tableExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        ) as exists;
      `, [table]);
      
      if (!tableExists.rows[0].exists) {
        console.log(`Table ${table} doesn't exist, skipping`);
        continue;
      }

      // Alter the tenant_id column to allow NULL values
      await executeQuery(`
        ALTER TABLE ${table}
        ALTER COLUMN tenant_id DROP NOT NULL;
      `);
      console.log(`Successfully updated ${table} to allow NULL tenant_id`);
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration();