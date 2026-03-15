/**
 * Hono Application Entry Point
 *
 * This is the main entry point for the Deno server, equivalent to the Express server.ts.
 * It configures middleware, mounts routes, and starts the HTTP server.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv } from './types/context.ts';
import { env } from './config/env.ts';
import { testConnection, closeConnection } from './db/client.ts';
import { runMigrations } from './config/runMigrations.ts';
import userService from './services/user.ts';
import { wsManager } from './services/websocket.ts';
import deviceApiKeyRepository from './repositories/deviceApiKey.ts';
import deviceRepository from './repositories/device.ts';

// Middleware
import {
  sanitizeInput,
  encodeOutput,
  addSecurityHeaders,
  generateCspNonce,
} from './middleware/xssProtection.ts';
import { sessionMiddleware } from './middleware/session.ts';
import { csrfProtection } from './middleware/csrf.ts';
import { attachTenantSecurityContext } from './middleware/tenantSecurity.ts';

// Routes
import authRoutes from './routes/auth.ts';
import deviceAuthRoutes from './routes/deviceAuth.ts';
import deviceRoutes from './routes/device.ts';
import userRoutes from './routes/user.ts';
import tenantRoutes from './routes/tenant.ts';
import playlistRoutes from './routes/playlist.ts';
import playlistGroupRoutes from './routes/playlistGroup.ts';
import setupRoutes from './routes/setup.ts';

const app = new Hono<AppEnv>();

// ---------------------------------------------------------------------------
// 1. CSP nonce generation
// ---------------------------------------------------------------------------
app.use('*', async (c, next) => {
  c.set('cspNonce', generateCspNonce());
  await next();
});

// ---------------------------------------------------------------------------
// 2. Security headers (replaces Helmet)
// ---------------------------------------------------------------------------
app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "blob:"],
    fontSrc: ["'self'"],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: 'cross-origin',
}));

// ---------------------------------------------------------------------------
// 3. Additional XSS headers
// ---------------------------------------------------------------------------
app.use('*', addSecurityHeaders);

// ---------------------------------------------------------------------------
// 4. CORS
// ---------------------------------------------------------------------------
app.use('*', cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
  exposeHeaders: ['set-cookie'],
}));

// ---------------------------------------------------------------------------
// 5. WebSocket endpoint for device push notifications
//    (before session/CSRF/sanitization middleware to avoid interference)
// ---------------------------------------------------------------------------
app.get('/api/device/ws', async (c) => {
  const apiKey = c.req.query('apiKey');
  if (!apiKey) {
    return c.json({ message: 'API key required' }, 401);
  }

  const validation = await deviceApiKeyRepository.validateApiKey(apiKey);
  if (!validation.valid || !validation.deviceId) {
    return c.json({ message: 'Invalid API key' }, 401);
  }

  const device = await deviceRepository.getDeviceById(validation.deviceId);
  if (!device) {
    return c.json({ message: 'Device not found' }, 404);
  }

  const { socket, response } = Deno.upgradeWebSocket(c.req.raw);

  socket.onopen = () => {
    const campaignIds = (device.displayCampaigns ?? []).map((dc) => dc.campaignId);
    wsManager.addConnection(device.id, device.tenantId ?? null, campaignIds, socket);
  };

  return response;
});

// ---------------------------------------------------------------------------
// 6. Request logging
// ---------------------------------------------------------------------------
app.use('*', async (c, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(2, 15);
  console.log(`[REQUEST][${requestId}] ${new Date().toISOString()} - ${c.req.method} ${c.req.path}`);
  await next();
  const duration = Date.now() - start;
  // Access status safely — c.res may have a locked body, but .status is always readable
  const status = c.res?.status ?? 0;
  console.log(`[RESPONSE][${requestId}] ${new Date().toISOString()} - ${c.req.method} ${c.req.path} - Status: ${status} - Duration: ${duration}ms`);
});

// ---------------------------------------------------------------------------
// 6. Connection headers (set BEFORE next() to avoid locked ReadableStream)
// ---------------------------------------------------------------------------
app.use('*', async (c, next) => {
  c.header('Connection', 'keep-alive');
  c.header('Keep-Alive', 'timeout=120');
  await next();
});

// ---------------------------------------------------------------------------
// 7. XSS input sanitization (after body parsing which Hono handles lazily)
// ---------------------------------------------------------------------------
app.use('*', sanitizeInput);

// ---------------------------------------------------------------------------
// 8. XSS output encoding
// ---------------------------------------------------------------------------
app.use('*', encodeOutput);

// ---------------------------------------------------------------------------
// 9. Session middleware
// ---------------------------------------------------------------------------
app.use('*', sessionMiddleware);

// ---------------------------------------------------------------------------
// 10. CSRF protection
// ---------------------------------------------------------------------------
app.use('*', csrfProtection);

// ---------------------------------------------------------------------------
// 11. Health check (before tenant security)
// ---------------------------------------------------------------------------
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Server is running',
  });
});

// ---------------------------------------------------------------------------
// 12. Tenant security context
// ---------------------------------------------------------------------------
app.use('*', attachTenantSecurityContext);

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
app.route('/api/device-auth', deviceAuthRoutes);
app.route('/api/device', deviceRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/users', userRoutes);
// Tenant routes require isAuthenticated at the route level
app.route('/api/tenants', tenantRoutes);
app.route('/api', playlistRoutes);
app.route('/api', playlistGroupRoutes);
app.route('/api', setupRoutes);

// ---------------------------------------------------------------------------
// Static file serving with CSP nonce injection
// ---------------------------------------------------------------------------
app.get('*', async (c) => {
  if (c.req.path.startsWith('/api')) {
    return c.json({ message: 'API endpoint not found' }, 404);
  }

  const clientPath = env.CLIENT_PATH;
  const basePath = import.meta.dirname || '.';
  const staticRoot = await Deno.realPath(`${basePath}/${clientPath}`);

  // Try to serve static file first
  try {
    if (c.req.path !== '/') {
      const resolvedPath = await Deno.realPath(`${staticRoot}${c.req.path}`);
      // Ensure resolved path stays within the static directory (prevents traversal)
      if (!resolvedPath.startsWith(staticRoot)) {
        return c.json({ message: 'Forbidden' }, 403);
      }
      const file = await Deno.readFile(resolvedPath);
      const ext = c.req.path.split('.').pop() || '';
      const mimeTypes: Record<string, string> = {
        'js': 'application/javascript',
        'css': 'text/css',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        'json': 'application/json',
        'woff': 'font/woff',
        'woff2': 'font/woff2',
      };
      return new Response(file, {
        headers: { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' },
      });
    }
  } catch {
    // File not found, serve index.html (SPA fallback)
  }

  // SPA fallback: serve index.html with nonce injection
  try {
    const indexPath = `${basePath}/${clientPath}/index.html`;
    let html = await Deno.readTextFile(indexPath);
    const nonce = c.get('cspNonce');
    html = html.replace(/<script/g, `<script nonce="${nonce}"`);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Error reading index.html:', err);
    return c.text('Internal Server Error', 500);
  }
});

// ---------------------------------------------------------------------------
// Initialize database and start server
// ---------------------------------------------------------------------------
async function initializeDatabase(): Promise<void> {
  const connected = await testConnection();
  if (!connected) {
    console.error('Failed to connect to database');
    Deno.exit(1);
  }

  // Run pending migrations before starting the application
  try {
    await runMigrations('up');
  } catch (error) {
    console.error('Migration failed:', error);
    Deno.exit(1);
  }

  await userService.createInitialAdminIfNeeded();

  // Clean up expired data
  try {
    const tenantRepository = (await import('./repositories/tenant.ts')).default;
    const cleanedInvitations = await tenantRepository.cleanExpiredInvitations();
    console.log(`Cleaned up ${cleanedInvitations} expired invitations`);

    const emailVerificationService = (await import('./services/emailVerification.ts')).default;
    const cleanedVerifications = await emailVerificationService.cleanExpiredEmailVerifications();
    console.log(`Cleaned up ${cleanedVerifications} expired verifications`);
  } catch (error) {
    console.error('Error cleaning up expired data:', error);
  }
}

await initializeDatabase();

wsManager.start();

Deno.serve({
  port: env.PORT,
  onListen({ port }) {
    console.log(`Server listening on http://localhost:${port}/`);
  },
}, app.fetch);

// Graceful shutdown
Deno.addSignalListener('SIGINT', () => {
  console.log('Caught interrupt signal');
  wsManager.stop();
  closeConnection().then(() => Deno.exit(0));
});
