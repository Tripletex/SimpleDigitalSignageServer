import { Request, Response, NextFunction } from 'express';
import { Pool, PoolClient } from 'pg';
import * as dotenv from 'dotenv';
import { SessionData } from 'express-session';

// Define the custom properties we're adding to the Request type
interface RequestWithPgClient extends Request {
  pgClient?: PoolClient;
  secureQuery?: <T>(callback: (client: PoolClient) => Promise<T>) => Promise<T>;
}

dotenv.config();

// Configure PostgreSQL connection
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'digital_signage_dev',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10)
});

// We now use the custom types defined in express.d.ts

/**
 * Middleware to set the current user ID for PostgreSQL Row Level Security
 * This enables database-level tenant isolation
 */
export const setRowLevelSecurityUser = async (req: Request, res: Response, next: NextFunction) => {
  // Cast to our extended type
  const typedReq = req as RequestWithPgClient;
  try {
    // Skip if no user is authenticated
    if (!req.session?.user?.id) {
      return next();
    }
    
    // Get a client from the pool
    const client = await pool.connect();
    
    try {
      // Set the current user ID in the PostgreSQL session
      // This value is used by Row Level Security policies to filter data
      // We've already checked that user exists above, but add a safety check for TypeScript
      if (req.session?.user?.id) {
        await client.query(`SET LOCAL app.current_user_id = $1`, [req.session.user.id]);
      }
      
      // Store the client in the request object for use in route handlers
      typedReq.pgClient = client;
      
      // Release client on response finish
      res.on('finish', () => {
        if (typedReq.pgClient) {
          typedReq.pgClient.release();
          typedReq.pgClient = undefined;
        }
      });
      
      next();
    } catch (err) {
      client.release();
      next(err);
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Alternative middleware approach:
 * Instead of maintaining a connection, this middleware generates a function
 * that attaches the user ID to each query as needed
 */
export const attachTenantSecurityContext = (req: Request, res: Response, next: NextFunction) => {
  // Cast to our extended type
  const typedReq = req as RequestWithPgClient;
  // Skip if no user is authenticated
  if (!req.session?.user?.id) {
    return next();
  }
  
  // Attach a secureQuery function to the request
  typedReq.secureQuery = async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    
    try {
      // Set user context for Row Level Security
      // We've already checked that user exists above, but add a safety check for TypeScript
      if (req.session?.user?.id) {
        await client.query(`SET LOCAL app.current_user_id = $1`, [req.session.user.id]);
      }
      
      // Execute the callback with the client
      return await callback(client);
    } finally {
      client.release();
    }
  };
  
  next();
};