import { z } from 'zod';

export const playlistItemSchema = z.object({
  type: z.string().min(1, 'Type is required'),
  url: z.object({ location: z.string().url() }).optional(),
  duration: z.number().int().positive('Duration must be positive'),
  position: z.number().int().optional(),
});

export const playlistSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  items: z.array(playlistItemSchema).optional(),
});

export const playlistReorderSchema = z.object({
  itemIds: z.array(z.string().uuid()),
});
