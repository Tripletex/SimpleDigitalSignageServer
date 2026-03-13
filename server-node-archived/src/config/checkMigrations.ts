import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import { runMigrations } from './runMigrations';

// Database connection configuration
const dbConfig = {
  user: process.env.POSTGRES_USER || process.env.DB_USER || 'signage',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'signage',
  host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'localhost',
  database: process.env.POSTGRES_DB || process.env.DB_NAME || 'signage',
  port: parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5432', 10)
};

/**
 * Check if migrations are needed by comparing files in migrations directory with
 * entries in the pgmigrations table
 */
export async function checkMigrationsNeeded(): Promise<boolean> {
  const pool = new Pool(dbConfig);
  
  try {
    // First check if the pgmigrations table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'pgmigrations'
      ) as exists;
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    
    // If table doesn't exist, migrations are definitely needed
    if (!tableExists) {
      console.log('pgmigrations table does not exist, migrations needed');
      return true;
    }
    
    // Get applied migrations from database
    const result = await pool.query('SELECT name FROM pgmigrations ORDER BY name');
    const appliedMigrations = result.rows.map(row => row.name);
    
    // Get all migration files
    const migrationsDir = path.resolve(__dirname, '../../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .map(file => file.replace(/\.js$/, ''));
    
    // Check if there are new migration files not yet applied
    const pendingMigrations = migrationFiles.filter(file => !appliedMigrations.includes(file));
    
    if (pendingMigrations.length > 0) {
      console.log(`Found ${pendingMigrations.length} pending migrations`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking migrations status:', error);
    // Assume migrations are needed if check fails
    return true;
  } finally {
    await pool.end();
  }
}

/**
 * Run migrations if needed
 */
export async function runMigrationsIfNeeded(): Promise<void> {
  const needed = await checkMigrationsNeeded();
  
  if (needed) {
    console.log('Running pending migrations...');
    await runMigrations('up');
    console.log('Migrations complete');
  } else {
    console.log('Database is up to date, no migrations needed');
  }
}

// If running this file directly
if (require.main === module) {
  runMigrationsIfNeeded()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration check failed:', err);
      process.exit(1);
    });
}