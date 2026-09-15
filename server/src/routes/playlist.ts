import { Hono } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { handleErrors } from '../helpers/errorHandler.ts';
import * as playlistController from '../controllers/playlist.ts';
import { isAuthenticated } from '../middleware/auth.ts';
import { requireTenantMember } from '../middleware/tenantAuthorization.ts';

const app = new Hono<AppEnv>();

app.get('/tenant/:tenantId/playlists', isAuthenticated, requireTenantMember, handleErrors(playlistController.getPlaylists));
app.post('/tenant/:tenantId/playlists', isAuthenticated, requireTenantMember, handleErrors(playlistController.createPlaylist));
app.get('/playlists/:id', isAuthenticated, handleErrors(playlistController.getPlaylistById));
app.put('/tenant/:tenantId/playlists/:id', isAuthenticated, requireTenantMember, handleErrors(playlistController.updatePlaylist));
app.delete('/tenant/:tenantId/playlists/:id', isAuthenticated, requireTenantMember, handleErrors(playlistController.deletePlaylist));
app.post('/tenant/:tenantId/playlists/:id/reorder', isAuthenticated, requireTenantMember, handleErrors(playlistController.reorderPlaylistItems));
app.get('/youtube/check-embed', isAuthenticated, handleErrors(playlistController.checkYoutubeEmbeddable));

export default app;
