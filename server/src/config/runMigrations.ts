import { runner } from 'node-pg-migrate';
import { resolve } from '@std/path';
import { env } from './env.ts';

/**
 * Run database migrations programmatically using node-pg-migrate's runner API.
 */
export async function runMigrations(direction: 'up' | 'down' = 'up', count?: number): Promise<void> {
  const serverDir = import.meta.dirname
    ? resolve(import.meta.dirname, '../..')
    : resolve(new URL('../..', import.meta.url).pathname);

  const migrationsDir = resolve(serverDir, 'migrations');

  const databaseUrl = `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;

  console.log(`Running migrations (${direction}) ...`);

  await runner({
    databaseUrl,
    dir: migrationsDir,
    direction,
    count: count ?? Infinity,
    migrationsTable: 'pgmigrations',
    log: console.log,
  });

  console.log(`Migrations (${direction}) completed successfully.`);
}

// If running this file directly
if (import.meta.main) {
  const args = Deno.args;
  const direction = (args[0] as 'up' | 'down') || 'up';
  const count = args[1] ? parseInt(args[1], 10) : undefined;

  try {
    await runMigrations(direction, count);
    Deno.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    Deno.exit(1);
  }
}
