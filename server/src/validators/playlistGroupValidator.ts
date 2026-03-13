import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const validDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export const playlistScheduleSchema = z.object({
  playlistId: z.string().uuid(),
  start: z.string().regex(timeRegex, 'Start must be HH:MM format'),
  end: z.string().regex(timeRegex, 'End must be HH:MM format'),
  days: z.array(z.enum(validDays)).min(1, 'At least one day required'),
});

export const playlistGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  schedules: z.array(playlistScheduleSchema).optional(),
});
