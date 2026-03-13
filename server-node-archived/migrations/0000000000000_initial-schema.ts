import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

/**
 * Create tables for everything user and tenant related
 *
 * @param pgm MigrationBuilder
 */
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
    last_login: {
      type: 'timestamp',
      default: null
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
  pgm.createIndex('authenticators', 'user_id');

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




  // Create indexes for relationships for improved performance
  pgm.createIndex('tenant_members', ['tenant_id', 'user_id'], { unique: true });
  pgm.createIndex('tenant_members', 'user_id');
  pgm.createIndex('pending_invitations', ['tenant_id', 'email'], { unique: true });
}

export function down(pgm: MigrationBuilder): void {
  // Drop tables in reverse order to handle dependencies
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