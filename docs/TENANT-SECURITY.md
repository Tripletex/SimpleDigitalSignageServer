# Multi-Tenant Security Implementation

This document describes the multi-tenant security implementation for the Digital Signage Server application. This security model ensures that data is properly isolated between tenants at multiple levels: database, application, and API.

## Database-Level Security

### Tenant Foreign Keys

All tenant-related tables have a direct foreign key reference to the `tenants` table:

- `devices` - directly references tenants
- `device_networks` - has explicit tenant_id reference
- `device_registrations` - has explicit tenant_id reference
- `device_auth_challenges` - has explicit tenant_id reference
- `playlist_groups` - directly references tenants
- `playlists` - directly references tenants
- `playlist_items` - has explicit tenant_id reference
- `playlist_schedules` - has explicit tenant_id reference
- Note: `authenticators` table does not have tenant_id because they are user-based credentials that can be used across tenants

### Row-Level Security

PostgreSQL Row-Level Security (RLS) is implemented to enforce tenant isolation at the database level:

1. **RLS Policies**: Each tenant-related table has a security policy that restricts access to rows based on the current user's tenant memberships.

2. **Security Functions**:
   - `check_tenant_access(tenant_id, user_id)` - Checks if a user is a member of a specific tenant
   - `get_user_tenant_ids(user_id)` - Returns all tenant IDs a user belongs to

3. **Session Variables**:
   - The current user's ID is stored in the PostgreSQL session variable `app.current_user_id`
   - This variable is used by RLS policies to filter data

## Application-Level Security

### Middleware

The `tenantSecurityMiddleware.ts` file provides two approaches for implementing tenant security:

1. **Connection-Based Approach** (`setRowLevelSecurityUser`):
   - Sets the current user ID at the PostgreSQL session level
   - Maintains a single database connection throughout the request

2. **Transaction-Based Approach** (`attachTenantSecurityContext`):
   - Attaches a `secureQuery` function to the request
   - This function creates a new connection, sets the security context, and executes the query

### Repository and Service Layer

Even with database-level security, the application enforces security at the service layer:

- All tenant-related operations include tenant ID validation
- Service methods verify that the user has access to the requested tenant
- Repositories include tenant ID in queries

## Using the Security Context

### In API Routes

```typescript
app.get('/api/protected-resource', async (req, res) => {
  try {
    // Use the secure query function
    const result = await req.secureQuery(async (client) => {
      // All queries executed with this client will respect RLS policies
      return client.query('SELECT * FROM devices');
    });
    
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});
```

### In Service Methods

```typescript
async function getDevicesByTenantId(tenantId, userId) {
  // Check tenant access (application-level check)
  const hasAccess = await tenantMembersRepository.checkMembership(tenantId, userId);
  if (!hasAccess) {
    throw new Error('Access denied');
  }
  
  // The query will be filtered by RLS automatically
  const devices = await deviceRepository.findAll();
  return devices;
}
```

## Benefits of This Approach

1. **Defense in Depth**: Security is enforced at multiple layers
2. **Preventing Data Leaks**: Even if application logic has bugs, database RLS prevents cross-tenant data access
3. **Simplified Code**: Application code doesn't need to include tenant filters in every query
4. **Performance**: Database-level filtering is efficient
5. **Auditability**: Security policies are centralized and clearly defined

## Limitations and Considerations

1. **Super Admin Access**: Super admins may need to bypass RLS policies, which can be done with:
   ```sql
   SET SESSION ROLE postgres; -- Only for true superusers
   ```

2. **Performance Impact**: Complex RLS policies can impact query performance, though our simple tenant-based filtering should be minimal

3. **Debugging**: When debugging database issues, be aware that RLS is active and filtering results