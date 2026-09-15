import { Hono } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { handleErrors } from '../helpers/errorHandler.ts';
import * as tenantSecretController from '../controllers/tenantSecret.ts';
import { isAuthenticated } from '../middleware/auth.ts';
import { requireTenantAdmin } from '../middleware/tenantAuthorization.ts';

const app = new Hono<AppEnv>();

app.get(
  '/tenant/:tenantId/secrets',
  isAuthenticated,
  requireTenantAdmin,
  handleErrors(tenantSecretController.getSecrets),
);

app.post(
  '/tenant/:tenantId/secrets',
  isAuthenticated,
  requireTenantAdmin,
  handleErrors(tenantSecretController.createSecret),
);

app.put(
  '/tenant/:tenantId/secrets/:secretId',
  isAuthenticated,
  requireTenantAdmin,
  handleErrors(tenantSecretController.updateSecret),
);

app.delete(
  '/tenant/:tenantId/secrets/:secretId',
  isAuthenticated,
  requireTenantAdmin,
  handleErrors(tenantSecretController.deleteSecret),
);

export default app;
