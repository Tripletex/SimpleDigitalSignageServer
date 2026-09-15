import { MigrationBuilder } from 'node-pg-migrate';

/**
 * Consolidated initial migration — creates all tables, enums, indexes,
 * RLS policies, and pgcrypto extension in one pass.
 *
 * Enum names and values match the Drizzle schema in src/db/schema/enums.ts.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // -----------------------------------------------------------------------
  // Extensions
  // -----------------------------------------------------------------------
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  // -----------------------------------------------------------------------
  // Enum types (must match Drizzle schema)
  // -----------------------------------------------------------------------
  pgm.createType('enum_tenant_members_role', ['owner', 'admin', 'member']);
  pgm.createType('enum_tenant_members_status', ['active', 'pending']);
  pgm.createType('enum_pending_invitations_role', ['owner', 'admin', 'member']);
  pgm.createType('device_health_status', ['HEALTHY', 'WARNING', 'ERROR', 'OFFLINE', 'UNKNOWN']);

  // -----------------------------------------------------------------------
  // Users & auth
  // -----------------------------------------------------------------------
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    display_name: { type: 'varchar(255)' },
    role: { type: 'varchar(20)', notNull: true, default: 'USER' },
    last_login: { type: 'timestamptz', default: null },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.createTable('authenticators', {
    id: { type: 'uuid', primaryKey: true },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    credential_id: { type: 'text', notNull: true },
    public_key: { type: 'text', notNull: true },
    counter: { type: 'text' },
    device_type: { type: 'varchar(255)', notNull: true },
    transports: { type: 'varchar(255)' },
    fmt: { type: 'varchar(255)' },
    name: { type: 'varchar(255)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('authenticators', 'user_id');

  pgm.createTable('email_verifications', {
    id: { type: 'uuid', primaryKey: true },
    email: { type: 'varchar(255)', notNull: true },
    token: { type: 'varchar(255)', notNull: true },
    is_first_user: { type: 'boolean', notNull: true, default: false },
    inviting_tenant_id: { type: 'varchar(255)' },
    invited_role: { type: 'varchar(255)' },
    expires_at: { type: 'timestamptz', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });

  // -----------------------------------------------------------------------
  // Tenants
  // -----------------------------------------------------------------------
  pgm.createTable('tenants', {
    id: { type: 'uuid', primaryKey: true },
    name: { type: 'varchar(255)', notNull: true },
    is_personal: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });

  pgm.createTable('tenant_members', {
    id: { type: 'uuid', primaryKey: true },
    tenant_id: { type: 'uuid', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    role: { type: 'enum_tenant_members_role', notNull: true },
    status: { type: 'enum_tenant_members_status', notNull: true, default: 'pending' },
    invited_by_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    joined_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('tenant_members', ['tenant_id', 'user_id'], { unique: true });
  pgm.createIndex('tenant_members', 'user_id');

  pgm.createTable('pending_invitations', {
    id: { type: 'uuid', primaryKey: true },
    tenant_id: { type: 'uuid', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    email: { type: 'varchar(255)', notNull: true },
    role: { type: 'enum_pending_invitations_role', notNull: true },
    invited_by_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    expires_at: { type: 'timestamptz', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('pending_invitations', ['tenant_id', 'email'], { unique: true });

  // -----------------------------------------------------------------------
  // Playlists
  // -----------------------------------------------------------------------
  pgm.createTable('playlist_groups', {
    id: { type: 'uuid', primaryKey: true },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    tenant_id: { type: 'uuid', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    created_by_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('playlist_groups', 'tenant_id');
  pgm.createIndex('playlist_groups', 'created_by_id');

  pgm.createTable('playlists', {
    id: { type: 'uuid', primaryKey: true },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    tenant_id: { type: 'uuid', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    created_by_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('playlists', 'tenant_id');
  pgm.createIndex('playlists', 'created_by_id');

  pgm.createTable('playlist_items', {
    id: { type: 'uuid', primaryKey: true },
    playlist_id: { type: 'uuid', notNull: true, references: 'playlists', onDelete: 'CASCADE' },
    position: { type: 'integer', notNull: true },
    type: { type: 'varchar(255)', notNull: true },
    data: { type: 'jsonb' },
    duration: { type: 'integer', notNull: true },
    tenant_id: { type: 'uuid', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('playlist_items', 'playlist_id');
  pgm.createIndex('playlist_items', 'tenant_id');

  pgm.createTable('playlist_schedules', {
    id: { type: 'uuid', primaryKey: true },
    playlist_group_id: { type: 'uuid', notNull: true, references: 'playlist_groups', onDelete: 'CASCADE' },
    playlist_id: { type: 'uuid', notNull: true, references: 'playlists', onDelete: 'CASCADE' },
    start: { type: 'varchar(5)', notNull: true },
    end: { type: 'varchar(5)', notNull: true },
    days: { type: 'text[]', notNull: true },
    tenant_id: { type: 'uuid', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('playlist_schedules', 'playlist_group_id');
  pgm.createIndex('playlist_schedules', 'playlist_id');
  pgm.createIndex('playlist_schedules', 'tenant_id');

  // -----------------------------------------------------------------------
  // Devices
  // -----------------------------------------------------------------------
  pgm.createTable('devices', {
    id: { type: 'uuid', primaryKey: true },
    name: { type: 'varchar(255)', notNull: true },
    tenant_id: { type: 'uuid', references: 'tenants', onDelete: 'SET NULL' },
    claimed_by_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    claimed_at: { type: 'timestamptz' },
    display_name: { type: 'varchar(255)' },
    display_count: { type: 'integer', notNull: true, default: 0 },
    displays: { type: 'jsonb' },
    health_status: { type: 'device_health_status', notNull: true, default: 'UNKNOWN' },
    last_health_check: { type: 'timestamptz', default: null },
    health_details: { type: 'jsonb', default: '{}' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('devices', 'tenant_id');
  pgm.createIndex('devices', 'claimed_by_id');

  pgm.createTable('device_display_campaigns', {
    id: { type: 'uuid', primaryKey: true },
    device_id: { type: 'uuid', notNull: true, references: 'devices', onDelete: 'CASCADE' },
    display_name: { type: 'varchar(255)', notNull: true },
    hardware_id: { type: 'varchar(255)' },
    campaign_id: { type: 'uuid', notNull: true, references: 'playlist_groups', onDelete: 'CASCADE' },
    tenant_id: { type: 'uuid', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('device_display_campaigns', ['device_id', 'display_name'], { unique: true });
  pgm.createIndex('device_display_campaigns', 'device_id');
  pgm.createIndex('device_display_campaigns', 'campaign_id');
  pgm.createIndex('device_display_campaigns', 'tenant_id');

  pgm.createTable('device_networks', {
    id: { type: 'uuid', primaryKey: true },
    device_id: { type: 'uuid', notNull: true, references: 'devices', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    ip_addresses: { type: 'text[]', notNull: true, default: '{}' },
    tenant_id: { type: 'uuid', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('device_networks', 'device_id');
  pgm.createIndex('device_networks', 'tenant_id');

  pgm.createTable('device_registrations', {
    id: { type: 'uuid', primaryKey: true },
    device_id: { type: 'uuid', notNull: true, references: 'devices', onDelete: 'CASCADE' },
    device_type: { type: 'varchar(255)' },
    hardware_id: { type: 'varchar(255)' },
    public_key: { type: 'text', notNull: true },
    registration_time: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    last_seen: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    active: { type: 'boolean', notNull: true, default: true },
    tenant_id: { type: 'uuid', references: 'tenants', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('device_registrations', 'device_id');
  pgm.createIndex('device_registrations', 'tenant_id');

  pgm.createTable('device_auth_challenges', {
    id: { type: 'uuid', primaryKey: true },
    device_id: { type: 'uuid', notNull: true, references: 'devices', onDelete: 'CASCADE' },
    challenge: { type: 'text', notNull: true },
    expires: { type: 'timestamptz', notNull: true },
    used: { type: 'boolean', notNull: true, default: false },
    tenant_id: { type: 'uuid', references: 'tenants', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('device_auth_challenges', 'device_id');
  pgm.createIndex('device_auth_challenges', 'tenant_id');

  pgm.createTable('device_api_keys', {
    id: { type: 'uuid', primaryKey: true, notNull: true },
    device_id: { type: 'uuid', notNull: true, references: 'devices(id)' },
    tenant_id: { type: 'uuid', notNull: false, references: 'tenants(id)' },
    api_key_hash: { type: 'text', notNull: true },
    expires_at: { type: 'timestamptz', notNull: false },
    active: { type: 'boolean', notNull: true, default: true },
    last_used: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('device_api_keys', 'device_id');
  pgm.createIndex('device_api_keys', 'tenant_id');
  pgm.createIndex('device_api_keys', 'api_key_hash', { unique: true });
  pgm.createIndex('device_api_keys', 'active');

  // -----------------------------------------------------------------------
  // Tenant secrets
  // -----------------------------------------------------------------------
  pgm.createTable('tenant_secrets', {
    id: { type: 'uuid', primaryKey: true },
    tenant_id: { type: 'uuid', notNull: true, references: 'tenants', onDelete: 'CASCADE' },
    name: { type: 'varchar(255)', notNull: true },
    encrypted_value: { type: 'text', notNull: true },
    domain: { type: 'varchar(255)' },
    description: { type: 'text' },
    created_by_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
  });
  pgm.createIndex('tenant_secrets', ['tenant_id', 'name'], { unique: true });
  pgm.createIndex('tenant_secrets', 'tenant_id');

  // -----------------------------------------------------------------------
  // Row-Level Security
  // -----------------------------------------------------------------------
  pgm.sql(`
    CREATE OR REPLACE FUNCTION check_tenant_access(requested_tenant_id UUID, current_user_id UUID)
    RETURNS BOOLEAN AS $$
    DECLARE is_member BOOLEAN;
    BEGIN
      SELECT EXISTS (
        SELECT 1 FROM tenant_members
        WHERE tenant_id = requested_tenant_id AND user_id = current_user_id
      ) INTO is_member;
      RETURN is_member;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql(`
    CREATE OR REPLACE FUNCTION get_user_tenant_ids(current_user_id UUID)
    RETURNS TABLE(tenant_id UUID) AS $$
    BEGIN
      RETURN QUERY
        SELECT tm.tenant_id FROM tenant_members tm WHERE tm.user_id = current_user_id;
    END;
    $$ LANGUAGE plpgsql;
  `);

  const rlsTables = [
    'tenants', 'tenant_members', 'devices', 'device_networks',
    'device_registrations', 'device_auth_challenges', 'device_display_campaigns',
    'playlist_groups', 'playlists', 'playlist_items', 'playlist_schedules',
    'tenant_secrets',
  ];

  for (const table of rlsTables) {
    pgm.sql(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
  }

  const tenantCol = (table: string) =>
    table === 'tenants' ? 'id' : 'tenant_id';

  for (const table of rlsTables) {
    const col = tenantCol(table);
    pgm.sql(`
      CREATE POLICY ${table}_isolation_policy ON ${table}
      USING (${col} IN (SELECT tenant_id FROM get_user_tenant_ids(current_setting('app.current_user_id')::UUID)));
    `);
  }
}

export function down(pgm: MigrationBuilder): void {
  const rlsTables = [
    'tenants', 'tenant_members', 'devices', 'device_networks',
    'device_registrations', 'device_auth_challenges', 'device_display_campaigns',
    'playlist_groups', 'playlists', 'playlist_items', 'playlist_schedules',
    'tenant_secrets',
  ];

  for (const table of rlsTables) {
    pgm.sql(`DROP POLICY IF EXISTS ${table}_isolation_policy ON ${table};`);
    pgm.sql(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`);
  }

  pgm.sql('DROP FUNCTION IF EXISTS check_tenant_access(UUID, UUID);');
  pgm.sql('DROP FUNCTION IF EXISTS get_user_tenant_ids(UUID);');

  pgm.dropTable('tenant_secrets');
  pgm.dropTable('device_api_keys');
  pgm.dropTable('device_auth_challenges');
  pgm.dropTable('device_registrations');
  pgm.dropTable('device_display_campaigns');
  pgm.dropTable('device_networks');
  pgm.dropTable('devices');
  pgm.dropTable('playlist_schedules');
  pgm.dropTable('playlist_items');
  pgm.dropTable('playlists');
  pgm.dropTable('playlist_groups');
  pgm.dropTable('pending_invitations');
  pgm.dropTable('tenant_members');
  pgm.dropTable('tenants');
  pgm.dropTable('email_verifications');
  pgm.dropTable('authenticators');
  pgm.dropTable('users');

  pgm.dropType('device_health_status');
  pgm.dropType('enum_pending_invitations_role');
  pgm.dropType('enum_tenant_members_role');
  pgm.dropType('enum_tenant_members_status');

  pgm.sql('DROP EXTENSION IF EXISTS pgcrypto');
}
