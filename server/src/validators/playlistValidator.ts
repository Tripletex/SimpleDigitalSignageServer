import { z } from 'zod';

export const playlistItemSchema = z.object({
  type: z.string().min(1, 'Type is required'),
  data: z.object({
    location: z.string().url(),
    muted: z.boolean().optional(),
    loop: z.boolean().optional(),
    loopCount: z.number().int().min(1).optional(),
  }).optional(),
  duration: z.number().int().min(0, 'Duration must be 0 or positive'),
  position: z.number().int().optional(),
});

export const playlistSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullish(),
  items: z.array(playlistItemSchema).optional(),
});

export const playlistReorderSchema = z.object({
  itemIds: z.array(z.string().uuid()),
});
