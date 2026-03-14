// All environment variables accessed via Deno.env.get() with defaults
export const env = {
  NODE_ENV: Deno.env.get('NODE_ENV') || 'development',
  PORT: parseInt(Deno.env.get('PORT') || '4000'),
  DB_HOST: Deno.env.get('DB_HOST') || 'localhost',
  DB_PORT: parseInt(Deno.env.get('DB_PORT') || '5432'),
  DB_USER: Deno.env.get('DB_USER') || 'signage',
  DB_PASSWORD: Deno.env.get('DB_PASSWORD') || 'signage',
  DB_NAME: Deno.env.get('DB_NAME') || 'signage',
  CORS_ORIGIN: Deno.env.get('CORS_ORIGIN') || 'http://localhost:3000',
  RP_ID: Deno.env.get('RP_ID') || 'localhost',
  ORIGIN: Deno.env.get('ORIGIN') || 'http://localhost:3000',
  SESSION_SECRET: Deno.env.get('SESSION_SECRET') || '',
  CLIENT_PATH: Deno.env.get('CLIENT_PATH') || '../dist',
  JWT_SECRET: Deno.env.get('JWT_SECRET') || '',
  get isDev() { return this.NODE_ENV === 'development'; },
  get isProd() { return this.NODE_ENV === 'production'; },
};
