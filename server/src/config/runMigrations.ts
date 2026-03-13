import { env } from './env.ts';

// Default to 'dev' environment if NODE_ENV not set
const nodeEnv = env.NODE_ENV || 'dev';

/**
 * Run database migrations using node-pg-migrate via Deno.Command
 */
export async function runMigrations(direction: 'up' | 'down' = 'up', count?: number): Promise<void> {
  // Migrations are in the server root (two levels up from src/config/)
  const serverDir = import.meta.dirname
    ? `${import.meta.dirname}/../..`
    : new URL('../..', import.meta.url).pathname;

  const args = [
    'node-pg-migrate',
    direction,
  ];

  // Add count if specified
  if (count !== undefined) {
    args.push(count.toString());
  }

  // Add migrations directory
  args.push('-m', 'migrations');

  console.log(`Running migrations (${direction}${count !== undefined ? ' ' + count : ''}) in ${nodeEnv} environment...`);

  const cmd = new Deno.Command('npx', {
    args,
    cwd: serverDir,
    env: {
      PGDATABASE: Deno.env.get('POSTGRES_DB') || Deno.env.get('DB_NAME') || 'signage',
      PGUSER: Deno.env.get('POSTGRES_USER') || Deno.env.get('DB_USER') || 'signage',
      PGPASSWORD: Deno.env.get('POSTGRES_PASSWORD') || Deno.env.get('DB_PASSWORD') || 'signage',
      PGHOST: Deno.env.get('POSTGRES_HOST') || Deno.env.get('DB_HOST') || 'localhost',
      PGPORT: Deno.env.get('POSTGRES_PORT') || Deno.env.get('DB_PORT') || '5432',
      NODE_ENV: nodeEnv,
      PATH: Deno.env.get('PATH') || '',
    },
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const { code } = await cmd.output();

  if (code === 0) {
    console.log(`Migrations (${direction}) completed successfully.`);
  } else {
    throw new Error(`Migration (${direction}) failed with code ${code}`);
  }
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
