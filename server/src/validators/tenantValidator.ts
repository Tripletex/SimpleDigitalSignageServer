import { z } from 'zod';

export const tenantCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});

export const tenantUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});

export const tenantInviteSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['owner', 'admin', 'member']),
});

export const tenantMemberUpdateSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
});
