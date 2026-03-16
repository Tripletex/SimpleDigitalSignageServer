import { Hono } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { handleErrors } from '../helpers/errorHandler.ts';
import * as setupController from '../controllers/setup.ts';
import { isAuthenticated } from '../middleware/auth.ts';

const app = new Hono<AppEnv>();

app.get('/health', handleErrors(setupController.healthCheck));
// Dev-only debug routes
app.get('/debug/tenants', isAuthenticated, handleErrors(setupController.debugUserTenants));
app.post('/dev/reset-users', isAuthenticated, handleErrors(setupController.resetUsers));

export default app;
