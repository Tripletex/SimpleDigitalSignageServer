import { z } from 'zod';

export const createSecretSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  value: z.string().min(1, 'Value is required'),
  description: z.string().max(1000).optional(),
});

export const updateSecretSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  value: z.string().min(1).optional(),
  description: z.string().max(1000).optional(),
});
