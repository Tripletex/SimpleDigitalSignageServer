# Middleware Documentation

## Tenant Security Middleware

The `tenantSecurityMiddleware.ts` file provides middleware for implementing database-level tenant security with PostgreSQL Row Level Security (RLS).

### Usage in Route Handlers

To use the tenant security context in your routes:

```typescript
import { Request, Response, NextFunction } from 'express';
import { PoolClient } from 'pg';

// Define interface for typed access to the secureQuery function
interface SecureRequest extends Request {
  secureQuery?: <T>(callback: (client: PoolClient) => Promise<T>) => Promise<T>;
}

// Get all devices with tenant security
app.get('/api/devices', async (req: SecureRequest, res: Response, next: NextFunction) => {
  try {
    // Safely check if secureQuery is available
    if (!req.secureQuery) {
      return res.status(500).json({ error: 'Security context not available' });
    }

    // Use secureQuery to run database queries with tenant isolation
    const result = await req.secureQuery(async (client) => {
      // This query will be automatically filtered by PostgreSQL RLS
      // to only return devices from tenants the user belongs to
      return client.query('SELECT * FROM devices');
    });

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});
```

### About the Middleware

The middleware adds a `secureQuery` function to the request object that:

1. Creates a database connection
2. Sets the current user ID in the PostgreSQL session
3. Executes your query callback with proper tenant filtering
4. Automatically releases the connection when done

### TypeScript Support

For TypeScript support, use one of these approaches:

1. Type assertion:
```typescript
(req as any).secureQuery(async (client) => {
  // Your query here
});
```

2. Interface extension:
```typescript
interface SecureRequest extends Request {
  secureQuery?: <T>(callback: (client: PoolClient) => Promise<T>) => Promise<T>;
}

app.get('/path', async (req: SecureRequest, res) => {
  if (req.secureQuery) {
    await req.secureQuery(async (client) => {
      // Your query here
    });
  }
});
```

### Security Notes

- The middleware automatically skips setting the security context if no user is authenticated
- All queries executed through `secureQuery` will be filtered by the RLS policies
- This provides defense-in-depth: even if your application logic has bugs, the database will still enforce tenant isolation