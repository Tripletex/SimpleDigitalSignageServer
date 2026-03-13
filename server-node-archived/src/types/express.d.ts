import { PoolClient } from 'pg';
import 'express';

declare module 'express' {
  interface Request {
    // Custom property for tenant security middleware
    pgClient?: PoolClient;
    
    // Function to execute queries with tenant security context
    secureQuery?: <T>(callback: (client: PoolClient) => Promise<T>) => Promise<T>;
  }
}