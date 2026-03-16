import { Hono } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { handleErrors } from '../helpers/errorHandler.ts';
import * as playlistGroupController from '../controllers/playlistGroup.ts';
import { isAuthenticated } from '../middleware/auth.ts';
import { requireTenantMember } from '../middleware/tenantAuthorization.ts';

const app = new Hono<AppEnv>();

app.get('/tenant/:tenantId/playlist-groups', isAuthenticated, requireTenantMember, handleErrors(playlistGroupController.getPlaylistGroups));
app.post('/tenant/:tenantId/playlist-groups', isAuthenticated, requireTenantMember, handleErrors(playlistGroupController.createPlaylistGroup));
app.get('/playlist-groups/:id', isAuthenticated, handleErrors(playlistGroupController.getPlaylistGroupById));
app.put('/tenant/:tenantId/playlist-groups/:id', isAuthenticated, requireTenantMember, handleErrors(playlistGroupController.updatePlaylistGroup));
app.delete('/tenant/:tenantId/playlist-groups/:id', isAuthenticated, requireTenantMember, handleErrors(playlistGroupController.deletePlaylistGroup));
app.post('/tenant/:tenantId/playlist-groups/:id/schedules', isAuthenticated, requireTenantMember, handleErrors(playlistGroupController.addSchedule));
app.delete('/tenant/:tenantId/playlist-groups/:id/schedules/:scheduleId', isAuthenticated, requireTenantMember, handleErrors(playlistGroupController.deleteSchedule));

export default app;
