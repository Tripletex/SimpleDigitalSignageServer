import { Hono } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { handleErrors } from '../helpers/errorHandler.ts';
import * as deviceController from '../controllers/device.ts';
import { requireApiKey, requireApiKeyOrAuth } from '../middleware/apiKeyAuth.ts';
import { isAuthenticated } from '../middleware/auth.ts';
import { requireTenantMember } from '../middleware/tenantAuthorization.ts';
import { rateLimit } from '../middleware/rateLimit.ts';

const app = new Hono<AppEnv>();

app.post('/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 10 }), handleErrors(deviceController.registerDevice));
app.post('/ping', requireApiKey, handleErrors(deviceController.pingDevice));
app.get('/list', requireApiKeyOrAuth, handleErrors(deviceController.getAllDevices));
app.get('/registered', requireApiKeyOrAuth, handleErrors(deviceController.getAllRegisteredDevices));
app.get('/tenant/:tenantId/devices', isAuthenticated, requireTenantMember, handleErrors(deviceController.getTenantDevices));
app.post('/tenant/:tenantId/claim', isAuthenticated, requireTenantMember, handleErrors(deviceController.claimDevice));
app.delete('/tenant/:tenantId/devices/:deviceId', isAuthenticated, requireTenantMember, handleErrors(deviceController.releaseDevice));
app.post('/tenant/:tenantId/devices/:deviceId/campaign', isAuthenticated, requireTenantMember, handleErrors(deviceController.assignCampaign));
app.get('/:id', requireApiKeyOrAuth, handleErrors(deviceController.getDeviceById));

export default app;
