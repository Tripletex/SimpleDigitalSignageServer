import type { Context } from 'hono';
import { ZodError } from 'zod';
import { env } from '../config/env.ts';
import type { AppEnv } from '../types/context.ts';

export function handleErrors(
  controllerFunction: (c: Context<AppEnv>) => Promise<Response>
): (c: Context<AppEnv>) => Promise<Response> {
  return async (c: Context<AppEnv>) => {
    try {
      return await controllerFunction(c);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error('Zod validation error:', JSON.stringify(error.errors));
        return c.json({ message: error.errors.map(e => e.message).join(', ') }, 400);
      } else if (error instanceof Error) {
        console.error('Unhandled error:', error.message, error.stack);
        return c.json({
          message: env.isDev ? error.message : 'Internal server error',
        }, 500);
      } else {
        console.error('Unknown error:', error);
        return c.json({
          message: env.isDev ? 'An unknown error occurred' : 'Internal server error',
          ...(env.isDev && { error }),
        }, 500);
      }
    }
  };
}
