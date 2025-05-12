import path from 'path';
import { spawn } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

// Default to 'dev' environment if NODE_ENV not set
const nodeEnv = process.env.NODE_ENV || 'dev';

/**
 * Run database migrations using node-pg-migrate
 */
export async function runMigrations(direction: 'up' | 'down' = 'up', count?: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      path.resolve(__dirname, '../../node_modules/.bin/node-pg-migrate'),
      direction
    ];
    
    // Add count if specified
    if (count !== undefined) {
      args.push(count.toString());
    }
    
    console.log(`Running migrations (${direction}${count !== undefined ? ' ' + count : ''}) in ${nodeEnv} environment...`);
    
    const migrate = spawn('node', args, {
      env: {
        ...process.env,
        PGDATABASE: process.env.POSTGRES_DB || process.env.DB_NAME || 'signage',
        PGUSER: process.env.POSTGRES_USER || process.env.DB_USER || 'signage',
        PGPASSWORD: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'signage',
        PGHOST: process.env.POSTGRES_HOST || process.env.DB_HOST || 'localhost',
        PGPORT: process.env.POSTGRES_PORT || process.env.DB_PORT || '5432',
        NODE_ENV: nodeEnv
      },
      stdio: 'inherit'
    });
    
    migrate.on('close', (code) => {
      if (code === 0) {
        console.log(`Migrations (${direction}) completed successfully.`);
        resolve();
      } else {
        console.error(`Migration (${direction}) failed with code ${code}.`);
        reject(new Error(`Migration failed with code ${code}`));
      }
    });
    
    migrate.on('error', (err) => {
      console.error('Failed to run migrations:', err);
      reject(err);
    });
  });
}

// If running this file directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const direction = args[0] as 'up' | 'down' || 'up';
  const count = args[1] ? parseInt(args[1], 10) : undefined;
  
  runMigrations(direction, count)
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}