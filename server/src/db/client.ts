import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env.ts';
import * as schema from './schema/index.ts';

const connectionString = `postgres://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;

const queryClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });

export async function testConnection(): Promise<boolean> {
  try {
    await queryClient`SELECT 1`;
    console.log('Database connection established successfully.');
    return true;
  } catch (error) {
    console.error('Unable to connect to database:', error);
    return false;
  }
}

export async function closeConnection(): Promise<void> {
  await queryClient.end();
}

export { queryClient };
