/* eslint-disable camelcase */

/**
 * Create device_api_keys table for API key-based authentication
 */
exports.up = pgm => {
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

  // Add indexes
  pgm.createIndex('device_api_keys', 'device_id');
  pgm.createIndex('device_api_keys', 'tenant_id');
  pgm.createIndex('device_api_keys', 'api_key', { unique: true });
  pgm.createIndex('device_api_keys', 'active');
};

/**
 * Remove the device_api_keys table
 */
exports.down = pgm => {
  pgm.dropTable('device_api_keys');
};