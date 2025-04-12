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

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Set headers to handle large requests
app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=120');
  next();
});
// Increase JSON request size limit to handle WebAuthn data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Session management
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: COOKIE_CONFIG as any
}));

// API Routes
// - Device routes (ping and register are public, others require auth)
// These paths are relative to the mount point (/api/device),
// so we just need the endpoint name: '/ping' and '/register'
app.use('/api/device', excludeRoutes([
  '/ping',
  '/register'
]), deviceRoutes);

// - Device authentication routes (no auth required)
app.use('/api/device/auth', deviceAuthRoutes);

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