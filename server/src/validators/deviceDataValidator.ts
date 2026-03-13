import { z } from 'zod';

export const networkSchema = z.object({
  name: z.string().min(1),
  ipAddress: z.array(z.string()),
});

export const deviceDataSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  networks: z.array(networkSchema).optional(),
});
