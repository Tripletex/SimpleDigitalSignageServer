import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create users table
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    display_name: { type: 'varchar(255)' },
    role: { 
      type: 'varchar(20)', 
      notNull: true, 
      default: 'USER' 
    },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // Create enum types
  pgm.createType('tenant_role', ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']);
  pgm.createType('tenant_member_status', ['ACTIVE', 'PENDING', 'INACTIVE']);

  // Create authenticators table
  pgm.createTable('authenticators', {
    id: { type: 'uuid', primaryKey: true },
    user_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE'
    },
    credential_id: { type: 'text', notNull: true },
    public_key: { type: 'text', notNull: true },
    counter: { type: 'text' },
    device_type: { type: 'varchar(255)', notNull: true },
    transports: { type: 'varchar(255)' },
    fmt: { type: 'varchar(255)' },
    name: { type: 'varchar(255)' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // Create email_verifications table
  pgm.createTable('email_verifications', {
    id: { type: 'uuid', primaryKey: true },
    email: { type: 'varchar(255)', notNull: true },
    token: { type: 'varchar(255)', notNull: true },
    is_first_user: { type: 'boolean', notNull: true, default: false },
    inviting_tenant_id: { type: 'varchar(255)' },
    invited_role: { type: 'varchar(255)' },
    expires_at: { type: 'timestamp', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // Create tenants table
  pgm.createTable('tenants', {
    id: { type: 'uuid', primaryKey: true },
    name: { type: 'varchar(255)', notNull: true },
    is_personal: { type: 'boolean', notNull: true, default: false },
    owner_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE'
    },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // Create tenant_members table
  pgm.createTable('tenant_members', {
    id: { type: 'uuid', primaryKey: true },
    tenant_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'tenants',
      onDelete: 'CASCADE'
    },
    user_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE'
    },
    role: { type: 'tenant_role', notNull: true },
    status: { type: 'tenant_member_status', notNull: true, default: 'PENDING' },
    invited_by_id: { 
      type: 'uuid',
      references: 'users',
      onDelete: 'SET NULL'
    },
    joined_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // Create pending_invitations table
  pgm.createTable('pending_invitations', {
    id: { type: 'uuid', primaryKey: true },
    tenant_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'tenants',
      onDelete: 'CASCADE'
    },
    email: { type: 'varchar(255)', notNull: true },
    role: { type: 'tenant_role', notNull: true },
    invited_by_id: { 
      type: 'uuid',
      references: 'users',
      onDelete: 'SET NULL'
    },
    expires_at: { type: 'timestamp', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // Create playlist_groups table first as it's referenced by devices
  pgm.createTable('playlist_groups', {
    id: { type: 'uuid', primaryKey: true },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    tenant_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'tenants',
      onDelete: 'CASCADE'
    },
    created_by_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE'
    },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // Create devices table
  pgm.createTable('devices', {
    id: { type: 'uuid', primaryKey: true },
    name: { type: 'varchar(255)', notNull: true },
    tenant_id: { 
      type: 'uuid',
      references: 'tenants',
      onDelete: 'SET NULL'
    },
    claimed_by_id: { 
      type: 'uuid',
      references: 'users',
      onDelete: 'SET NULL'
    },
    claimed_at: { type: 'timestamp' },
    display_name: { type: 'varchar(255)' },
    campaign_id: {
      type: 'uuid',
      references: 'playlist_groups',
      onDelete: 'SET NULL'
    },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // Create device_networks table
  pgm.createTable('device_networks', {
    id: { type: 'uuid', primaryKey: true },
    device_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'devices',
      onDelete: 'CASCADE'
    },
    name: { type: 'varchar(255)', notNull: true },
    ip_addresses: { type: 'text[]', notNull: true, default: '{}' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // Create device_registrations table
  pgm.createTable('device_registrations', {
    id: { type: 'uuid', primaryKey: true },
    device_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'devices',
      onDelete: 'CASCADE'
    },
    device_type: { type: 'varchar(255)' },
    hardware_id: { type: 'varchar(255)' },
    public_key: { type: 'text', notNull: true },
    registration_time: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    last_seen: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // Create device_auth_challenges table
  pgm.createTable('device_auth_challenges', {
    id: { type: 'uuid', primaryKey: true },
    device_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'devices',
      onDelete: 'CASCADE'
    },
    challenge: { type: 'text', notNull: true },
    expires: { type: 'timestamp', notNull: true },
    used: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // Create playlists table
  pgm.createTable('playlists', {
    id: { type: 'uuid', primaryKey: true },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    tenant_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'tenants',
      onDelete: 'CASCADE'
    },
    created_by_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE'
    },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // Create playlist_items table
  pgm.createTable('playlist_items', {
    id: { type: 'uuid', primaryKey: true },
    playlist_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'playlists',
      onDelete: 'CASCADE'
    },
    position: { type: 'integer', notNull: true },
    type: { type: 'varchar(255)', notNull: true },
    url: { type: 'jsonb' },
    duration: { type: 'integer', notNull: true },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // Create playlist_schedules table
  pgm.createTable('playlist_schedules', {
    id: { type: 'uuid', primaryKey: true },
    playlist_group_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'playlist_groups',
      onDelete: 'CASCADE'
    },
    playlist_id: { 
      type: 'uuid', 
      notNull: true,
      references: 'playlists',
      onDelete: 'CASCADE'
    },
    start: { type: 'varchar(5)', notNull: true }, // "HH:MM" format
    end: { type: 'varchar(5)', notNull: true },   // "HH:MM" format
    days: { type: 'text[]', notNull: true },     // Array of days
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  // Create indexes for relationships for improved performance
  pgm.createIndex('authenticators', 'user_id');
  pgm.createIndex('tenant_members', ['tenant_id', 'user_id'], { unique: true });
  pgm.createIndex('tenant_members', 'user_id');
  pgm.createIndex('pending_invitations', ['tenant_id', 'email'], { unique: true });
  pgm.createIndex('devices', 'tenant_id');
  pgm.createIndex('devices', 'claimed_by_id');
  pgm.createIndex('devices', 'campaign_id');
  pgm.createIndex('device_networks', 'device_id');
  pgm.createIndex('device_registrations', 'device_id');
  pgm.createIndex('device_auth_challenges', 'device_id');
  pgm.createIndex('playlists', 'tenant_id');
  pgm.createIndex('playlists', 'created_by_id');
  pgm.createIndex('playlist_items', 'playlist_id');
  pgm.createIndex('playlist_groups', 'tenant_id');
  pgm.createIndex('playlist_groups', 'created_by_id');
  pgm.createIndex('playlist_schedules', 'playlist_group_id');
  pgm.createIndex('playlist_schedules', 'playlist_id');
}

export function down(pgm: MigrationBuilder): void {
  // Drop tables in reverse order to handle dependencies
  pgm.dropTable('playlist_schedules');
  pgm.dropTable('playlist_items');
  pgm.dropTable('playlists');
  pgm.dropTable('device_auth_challenges');
  pgm.dropTable('device_registrations');
  pgm.dropTable('device_networks');
  pgm.dropTable('devices');
  pgm.dropTable('playlist_groups');
  pgm.dropTable('pending_invitations');
  pgm.dropTable('tenant_members');
  pgm.dropTable('tenants');
  pgm.dropTable('email_verifications');
  pgm.dropTable('authenticators');
  pgm.dropTable('users');
  
  // Drop enum types
  pgm.dropType('tenant_role');
  pgm.dropType('tenant_member_status');
}