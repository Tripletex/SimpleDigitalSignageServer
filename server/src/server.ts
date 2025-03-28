import express from 'express';
import path from 'path';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';

// Routes
import deviceRoutes from './routes/deviceRoutes';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import setupRoutes from './routes/setupRoutes';

// Services and config
import { createAllTables } from './config/createTables';
import { SESSION_SECRET, COOKIE_CONFIG } from './config/webauthn';
import userService from './services/userService';
import { excludeRoutes } from './middleware/authMiddleware';

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
  exposedHeaders: ['set-cookie']
}));

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

// - Auth routes
app.use('/api/auth', authRoutes);

// - User management routes (admin only)
app.use('/api/users', userRoutes);

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
    await createAllTables();
    console.log('Database initialization completed');
    
    // Create initial admin user if no users exist
    await userService.createInitialAdminIfNeeded();
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
    if (process.env.DYNAMODB_ENDPOINT) {
      console.log(`Using local DynamoDB at ${process.env.DYNAMODB_ENDPOINT}`);
    } else {
      console.log(`Using AWS DynamoDB in region ${process.env.AWS_REGION || 'us-east-1'}`);
    }
  });
}

startServer();

process.on('SIGINT', function() {
  console.log("Caught interrupt signal");
  process.exit();
});