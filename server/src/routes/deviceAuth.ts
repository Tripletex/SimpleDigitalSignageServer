import { Hono } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { handleErrors } from '../helpers/errorHandler.ts';
import * as deviceAuthController from '../controllers/deviceAuth.ts';
import { rateLimit } from '../middleware/rateLimit.ts';

const app = new Hono<AppEnv>();

app.post('/challenge', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }), handleErrors(deviceAuthController.generateChallenge));
app.post('/verify', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }), handleErrors(deviceAuthController.verifyChallenge));
// Dev only debug endpoint
app.post('/debug-verify', handleErrors(deviceAuthController.debugVerify));

export default app;
