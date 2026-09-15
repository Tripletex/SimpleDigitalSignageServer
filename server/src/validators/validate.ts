import { z, ZodSchema } from 'zod';

export function validateAndSanitize<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function safeParse<T>(schema: ZodSchema<T>, data: unknown) {
  return schema.safeParse(data);
}
