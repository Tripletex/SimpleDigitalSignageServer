import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder): void {
  // Create a function to check tenant access
  pgm.sql(`
    CREATE OR REPLACE FUNCTION check_tenant_access(requested_tenant_id UUID, current_user_id UUID) 
    RETURNS BOOLEAN AS $$
    DECLARE
      is_member BOOLEAN;
    BEGIN
      -- Check if the user is a member of the requested tenant
      SELECT EXISTS (
        SELECT 1 FROM tenant_members
        WHERE tenant_id = requested_tenant_id AND user_id = current_user_id
      ) INTO is_member;
      
      -- Return true if user is a member, false otherwise
      RETURN is_member;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Create a function to get the current user's tenant IDs
  pgm.sql(`
    CREATE OR REPLACE FUNCTION get_user_tenant_ids(current_user_id UUID) 
    RETURNS TABLE(tenant_id UUID) AS $$
    BEGIN
      RETURN QUERY
        SELECT tm.tenant_id 
        FROM tenant_members tm
        WHERE tm.user_id = current_user_id;
    END;
    $$ LANGUAGE plpgsql;
  `);
  
  // Enable Row Level Security on tenant-specific tables
  const tablesWithRLS = [
    'tenants',
    'tenant_members',
    'devices',
    'device_networks', 
    'device_registrations', 
    'device_auth_challenges',
    'playlist_groups',
    'playlists',
    'playlist_items',
    'playlist_schedules'
    // Note: Authenticators are not included as they are user-based, not tenant-based
  ];
  
  // Enable Row Level Security for each table
  for (const table of tablesWithRLS) {
    pgm.sql(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
  }
  
  // Create policies for each table
  
  // Tenants table - users can only view tenants they are members of
  pgm.sql(`
    CREATE POLICY tenant_isolation_policy ON tenants
    USING (id IN (SELECT tenant_id FROM get_user_tenant_ids(current_setting('app.current_user_id')::UUID)));
  `);
  
  // Tenant members - users can only view members of tenants they belong to
  pgm.sql(`
    CREATE POLICY tenant_members_isolation_policy ON tenant_members
    USING (tenant_id IN (SELECT tenant_id FROM get_user_tenant_ids(current_setting('app.current_user_id')::UUID)));
  `);
  
  // Devices - users can only view devices belonging to their tenants
  pgm.sql(`
    CREATE POLICY devices_isolation_policy ON devices
    USING (tenant_id IN (SELECT tenant_id FROM get_user_tenant_ids(current_setting('app.current_user_id')::UUID)));
  `);
  
  // Device networks - users can only view device networks belonging to their tenants
  pgm.sql(`
    CREATE POLICY device_networks_isolation_policy ON device_networks
    USING (tenant_id IN (SELECT tenant_id FROM get_user_tenant_ids(current_setting('app.current_user_id')::UUID)));
  `);
  
  // Device registrations - users can only view device registrations belonging to their tenants
  pgm.sql(`
    CREATE POLICY device_registrations_isolation_policy ON device_registrations
    USING (tenant_id IN (SELECT tenant_id FROM get_user_tenant_ids(current_setting('app.current_user_id')::UUID)));
  `);
  
  // Device auth challenges - users can only view device auth challenges belonging to their tenants
  pgm.sql(`
    CREATE POLICY device_auth_challenges_isolation_policy ON device_auth_challenges
    USING (tenant_id IN (SELECT tenant_id FROM get_user_tenant_ids(current_setting('app.current_user_id')::UUID)));
  `);
  
  // Playlist groups - users can only view playlist groups belonging to their tenants
  pgm.sql(`
    CREATE POLICY playlist_groups_isolation_policy ON playlist_groups
    USING (tenant_id IN (SELECT tenant_id FROM get_user_tenant_ids(current_setting('app.current_user_id')::UUID)));
  `);
  
  // Playlists - users can only view playlists belonging to their tenants
  pgm.sql(`
    CREATE POLICY playlists_isolation_policy ON playlists
    USING (tenant_id IN (SELECT tenant_id FROM get_user_tenant_ids(current_setting('app.current_user_id')::UUID)));
  `);
  
  // Playlist items - users can only view playlist items belonging to their tenants
  pgm.sql(`
    CREATE POLICY playlist_items_isolation_policy ON playlist_items
    USING (tenant_id IN (SELECT tenant_id FROM get_user_tenant_ids(current_setting('app.current_user_id')::UUID)));
  `);
  
  // Playlist schedules - users can only view playlist schedules belonging to their tenants
  pgm.sql(`
    CREATE POLICY playlist_schedules_isolation_policy ON playlist_schedules
    USING (tenant_id IN (SELECT tenant_id FROM get_user_tenant_ids(current_setting('app.current_user_id')::UUID)));
  `);
  
  // Note: Authenticators don't have a tenant_id column since they are user-based,
  // not tenant-based. Users can belong to multiple tenants, and their authenticators
  // are personal. Therefore, no RLS policy is needed for authenticators.
}

export function down(pgm: MigrationBuilder): void {
  // Drop policies for each table
  const tablesWithRLS = [
    'tenants',
    'tenant_members',
    'devices',
    'device_networks', 
    'device_registrations', 
    'device_auth_challenges',
    'playlist_groups',
    'playlists',
    'playlist_items',
    'playlist_schedules'
    // Note: Authenticators are not included as they are user-based, not tenant-based
  ];
  
  // Drop Row Level Security for each table
  for (const table of tablesWithRLS) {
    pgm.sql(`DROP POLICY IF EXISTS ${table}_isolation_policy ON ${table};`);
    pgm.sql(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`);
  }
  
  // Drop the tenant access check functions
  pgm.sql(`DROP FUNCTION IF EXISTS check_tenant_access(UUID, UUID);`);
  pgm.sql(`DROP FUNCTION IF EXISTS get_user_tenant_ids(UUID);`);
}
