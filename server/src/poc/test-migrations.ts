console.log('Testing node-pg-migrate via Deno.Command...');

const serverDir = new URL('../..', import.meta.url).pathname;
const cmd = new Deno.Command('npx', {
  args: ['node-pg-migrate', 'up', '-m', 'migrations', '--dry-run'],
  cwd: serverDir,
  env: {
    ...Object.fromEntries(
      ['PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGHOST', 'PGPORT'].map(k => [k, Deno.env.get(k) || ''])
    ),
    PGDATABASE: Deno.env.get('DB_NAME') || 'signage',
    PGUSER: Deno.env.get('DB_USER') || 'signage',
    PGPASSWORD: Deno.env.get('DB_PASSWORD') || 'signage',
    PGHOST: Deno.env.get('DB_HOST') || 'localhost',
    PGPORT: Deno.env.get('DB_PORT') || '5432',
  },
  stdout: 'inherit',
  stderr: 'inherit',
});

const { code } = await cmd.output();
console.log(code === 0 ? 'SUCCESS: migrations work' : `FAILED: exit code ${code}`);
