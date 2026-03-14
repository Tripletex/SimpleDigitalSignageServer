import { Hono } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { handleErrors } from '../helpers/errorHandler.ts';
import * as tenantController from '../controllers/tenant.ts';
import { isAuthenticated } from '../middleware/auth.ts';
import {
  requireTenantMember,
  requireTenantAdmin,
  requireTenantOwner,
} from '../middleware/tenantAuthorization.ts';

const app = new Hono<AppEnv>();

// All tenant routes require authentication
app.use('*', isAuthenticated);

app.get('/', handleErrors(tenantController.getUserTenants));
app.post('/', handleErrors(tenantController.createTenant));
app.get('/:id', requireTenantMember, handleErrors(tenantController.getTenantDetails));
app.put('/:id', requireTenantAdmin, handleErrors(tenantController.updateTenant));
app.delete('/:id', requireTenantOwner, handleErrors(tenantController.deleteTenant));
app.post('/:id/invite', requireTenantAdmin, handleErrors(tenantController.inviteUser));
app.put('/:id/members/:userId/role', requireTenantAdmin, handleErrors(tenantController.updateMemberRole));
app.delete('/:id/members/:userId', requireTenantAdmin, handleErrors(tenantController.removeMember));
app.post('/:id/leave', requireTenantMember, handleErrors(tenantController.leaveTenant));
app.post('/personal/force-create', handleErrors(tenantController.forceCreatePersonalTenant));
app.post('/invitations/accept', handleErrors(tenantController.acceptPendingInvitations));

export default app;
