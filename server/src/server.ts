import express from 'express';
import path from 'path';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';

// Routes
import deviceRoutes from './routes/deviceRoutes';
import deviceAuthRoutes from './routes/deviceAuthRoutes';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import setupRoutes from './routes/setupRoutes';
import tenantRoutes from './routes/tenantRoutes';
import playlistRoutes from './routes/playlistRoutes';
import playlistGroupRoutes from './routes/playlistGroupRoutes';

// Services and config
import sequelize, { testConnection } from './config/database';
import { SESSION_SECRET, COOKIE_CONFIG } from './config/webauthn';
import userService from './services/userService';
import { excludeRoutes, isAuthenticated } from './middleware/authMiddleware';

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  exposedHeaders: ['set-cookie']
}));

// Comprehensive request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = Math.random().toString(36).substring(2, 15);
  
  // Log request details
  console.log(`[REQUEST][${requestId}] ${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log(`[REQUEST][${requestId}] Headers: ${JSON.stringify(req.headers)}`);
  
  // Log query parameters if present
  if (Object.keys(req.query).length > 0) {
    console.log(`[REQUEST][${requestId}] Query params: ${JSON.stringify(req.query)}`);
  }
  
  // Log request body if present (and not multipart form data)
  const contentType = req.headers['content-type'] || '';
  if (req.body && !contentType.includes('multipart/form-data')) {
    // Safely stringify the body, handling circular references
    const safeBody = JSON.stringify(req.body, (key, value) => {
      // Filter out sensitive data
      if (key.toLowerCase().includes('password') || 
          key.toLowerCase().includes('secret') || 
          key.toLowerCase().includes('token')) {
        return '[REDACTED]';
      }
      
      // For base64 or very long strings, truncate to prevent massive logs
      if (typeof value === 'string' && value.length > 200) {
        return value.substring(0, 200) + '... [truncated]';
      }
      
      return value;
    });
    
    console.log(`[REQUEST][${requestId}] Body: ${safeBody}`);
  }
  
  // Capture the original send method instead of end (more reliable with Express)
  const originalSend = res.send;
  
  // Override the send method to log response details
  res.send = function(body) {
    const duration = Date.now() - start;
    
    console.log(`[RESPONSE][${requestId}] ${new Date().toISOString()} - ${req.method} ${req.path} - Status: ${res.statusCode} - Duration: ${duration}ms`);
    
    // Call the original send method with explicit cast to fix TypeScript error
    return originalSend.apply(this, [body] as unknown as [body?: any]);
  };
  
  next();
});

// Set headers to handle large requests
app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=120');
  next();
});
// We need to extend the Express Request type for our rawBody property
// This is already done in express-session.d.ts

// Increase JSON request size limit to handle WebAuthn data
// Add the body parsers before our logging middleware so req.body is available for logging
app.use(express.json({ 
  limit: '50mb',
  verify: (req: express.Request, res: express.Response, buf: Buffer) => {
    // Store the raw body buffer for potential later use
    // This can be helpful for crypto verification that needs the exact bytes
    (req as any).rawBody = buf;
  }
}));

app.use(express.urlencoded({ 
  limit: '50mb', 
  extended: true,
  verify: (req: express.Request, res: express.Response, buf: Buffer) => {
    (req as any).rawBody = buf;
  }
}));

app.use(cookieParser());

// Session management
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: COOKIE_CONFIG as any
}));

// Add a simple health check endpoint for diagnostics
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Server is running' 
  });
});

// API Routes
// - Device authentication routes (no auth required) - MUST be before the device routes
app.use('/api/device-auth', deviceAuthRoutes);

// - Device routes (no authentication middleware at this level)
// Let each route handle its own authentication as needed
app.use('/api/device', deviceRoutes);

// - Auth routes
app.use('/api/auth', authRoutes);

// - User management routes (admin only)
app.use('/api/users', userRoutes);

// - Tenant routes (requires authentication)
app.use('/api/tenants', isAuthenticated, tenantRoutes);

// - Playlist routes
app.use('/api', playlistRoutes);

// - Playlist Group routes
app.use('/api', playlistGroupRoutes);

// - Setup routes
app.use('/api', setupRoutes);

// Serve static client files
const clientPath = process.env.CLIENT_PATH || '../../client/build';
app.use(express.static(path.join(__dirname, clientPath)));

// Serve index.html for any unknown routes (SPA support)
app.get('*', (req, res) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, clientPath, 'index.html'));
});

// Initialize database
async function initializeDatabase() {
  try {
    // Test database connection
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Failed to connect to the database');
    }
    
    // Sync models with database
    await sequelize.sync({ alter: true });
    console.log('Database initialization completed');
    
    // Check if users exist but don't create any automatically
    await userService.createInitialAdminIfNeeded();
    
    // Clean up expired invitations and verification tokens
    try {
      const tenantRepository = (await import('./repositories/tenantRepository')).default;
      const cleanedInvitations = await tenantRepository.cleanExpiredInvitations();
      console.log(`Cleaned up ${cleanedInvitations} expired invitations during startup`);
      
      const emailVerificationService = (await import('./services/emailVerificationService')).default;
      const cleanedVerifications = await emailVerificationService.cleanExpiredEmailVerifications();
      console.log(`Cleaned up ${cleanedVerifications} expired email verifications during startup`);
    } catch (error) {
      console.error('Error cleaning up expired data:', error);
      // Don't fail startup if this fails
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

// Start the server
async function startServer() {
  await initializeDatabase();
  
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`Connected to PostgreSQL database: ${process.env.DB_NAME || 'signage'}`);
  });
}

startServer();

process.on('SIGINT', function() {
  console.log("Caught interrupt signal");
  process.exit();
});