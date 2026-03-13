import { z } from 'zod';

export const deviceRegistrationRequestSchema = z.object({
  publicKey: z.string().min(1, 'Public key is required'),
  deviceType: z.string().optional(),
  hardwareId: z.string().optional(),
});

export const deviceClaimSchema = z.object({
  deviceId: z.string().uuid('Valid device ID required'),
  displayName: z.string().max(100).optional(),
});

export const deviceCampaignAssignmentSchema = z.object({
  deviceId: z.string().uuid('Valid device ID required'),
  campaignId: z.string().uuid().nullable(),
});
