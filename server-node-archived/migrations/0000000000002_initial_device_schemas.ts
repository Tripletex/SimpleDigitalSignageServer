import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Create tables for everything device related.
 *
 * @param pgm
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createType('device_health_status', [
    'HEALTHY',
    'WARNING',
    'ERROR',
    'OFFLINE',
    'UNKNOWN'
  ]);

  // Create devices table
  pgm.createTable('devices', {
    id: {type: 'uuid', primaryKey: true},
    name: {type: 'varchar(255)', notNull: true},
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
    claimed_at: {type: 'timestamp'},
    display_name: {type: 'varchar(255)'},
    campaign_id: {
      type: 'uuid',
      references: 'playlist_groups',
      onDelete: 'SET NULL'
    },
    health_status: {
      type: 'device_health_status',
      notNull: true,
      default: 'UNKNOWN'
    },
    last_health_check: {
      type: 'timestamp',
      default: null
    },
    health_details: {
      type: 'jsonb',
      default: '{}'
    },
    created_at: {type: 'timestamp', notNull: true, default: pgm.func('current_timestamp')},
    updated_at: {type: 'timestamp', notNull: true, default: pgm.func('current_timestamp')}
  });
  pgm.createIndex('devices', 'tenant_id');
  pgm.createIndex('devices', 'claimed_by_id');
  pgm.createIndex('devices', 'campaign_id');

  // Create device_networks table
  pgm.createTable('device_networks', {
    id: {type: 'uuid', primaryKey: true},
    device_id: {
      type: 'uuid',
      notNull: true,
      references: 'devices',
      onDelete: 'CASCADE'
    },
    name: {type: 'varchar(255)', notNull: true},
    ip_addresses: {type: 'text[]', notNull: true, default: '{}'},
    tenant_id: {
      type: 'uuid',
      references: 'tenants',
      onDelete: 'CASCADE',
      notNull: true
    },
    created_at: {type: 'timestamp', notNull: true, default: pgm.func('current_timestamp')},
    updated_at: {type: 'timestamp', notNull: true, default: pgm.func('current_timestamp')}
  });
  pgm.createIndex('device_networks', 'device_id');
  pgm.createIndex('device_networks', 'tenant_id');

  // Create device_registrations table
  pgm.createTable('device_registrations', {
    id: {type: 'uuid', primaryKey: true},
    device_id: {
      type: 'uuid',
      notNull: true,
      references: 'devices',
      onDelete: 'CASCADE'
    },
    device_type: {type: 'varchar(255)'},
    hardware_id: {type: 'varchar(255)'},
    public_key: {type: 'text', notNull: true},
    registration_time: {type: 'timestamp', notNull: true, default: pgm.func('current_timestamp')},
    last_seen: {type: 'timestamp', notNull: true, default: pgm.func('current_timestamp')},
    active: {type: 'boolean', notNull: true, default: true},
    tenant_id: {
      type: 'uuid',
      references: 'tenants',
      onDelete: 'CASCADE',
      notNull: false
    },
    created_at: {type: 'timestamp', notNull: true, default: pgm.func('current_timestamp')},
    updated_at: {type: 'timestamp', notNull: true, default: pgm.func('current_timestamp')}
  });
  pgm.createIndex('device_registrations', 'device_id');
  pgm.createIndex('device_registrations', 'tenant_id');

  // Create device_auth_challenges table
  pgm.createTable('device_auth_challenges', {
    id: {type: 'uuid', primaryKey: true},
    device_id: {
      type: 'uuid',
      notNull: true,
      references: 'devices',
      onDelete: 'CASCADE'
    },
    challenge: {type: 'text', notNull: true},
    expires: {type: 'timestamp', notNull: true},
    used: {type: 'boolean', notNull: true, default: false},
    tenant_id: {
      type: 'uuid',
      references: 'tenants',
      onDelete: 'CASCADE',
      notNull: false
    },
    created_at: {type: 'timestamp', notNull: true, default: pgm.func('current_timestamp')},
    updated_at: {type: 'timestamp', notNull: true, default: pgm.func('current_timestamp')}
  });
  pgm.createIndex('device_auth_challenges', 'device_id');
  pgm.createIndex('device_auth_challenges', 'tenant_id');

  pgm.createTable('device_api_keys', {
    id: {
      type: 'uuid',
      primaryKey: true,
      notNull: true
    },
    device_id: {
      type: 'uuid',
      notNull: true,
      references: 'devices(id)'
    },
    tenant_id: {
      type: 'uuid',
      notNull: false,
      references: 'tenants(id)'
    },
    api_key: {
      type: 'text',
      notNull: true,
      unique: true
    },
    expires_at: {
      type: 'timestamp',
      notNull: false
    },
    active: {
      type: 'boolean',
      notNull: true,
      default: true
    },
    last_used: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });
  pgm.createIndex('device_api_keys', 'device_id');
  pgm.createIndex('device_api_keys', 'tenant_id');
  pgm.createIndex('device_api_keys', 'api_key', { unique: true });
  pgm.createIndex('device_api_keys', 'active');
}

export function down(pgm: MigrationBuilder): void {
  // Drop tables in reverse order to handle dependencies
  pgm.dropTable('device_api_keys');
  pgm.dropTable('device_auth_challenges');
  pgm.dropTable('device_registrations');
  pgm.dropTable('device_networks');
  pgm.dropTable('devices');

  pgm.dropType('device_health_status');
}