import { z } from 'zod';

export const userRegisterSchema = z.object({
  email: z.string().email('Valid email is required'),
  displayName: z.string().min(1).max(100).optional(),
});
