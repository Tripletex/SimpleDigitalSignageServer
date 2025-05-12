/* eslint-disable camelcase */

/**
 * Update device_registrations and device_auth_challenges tables 
 * to make tenant_id column nullable
 */
exports.up = pgm => {
  // Alter the tenant_id column to allow NULL values in device_registrations
  pgm.alterColumn('device_registrations', 'tenant_id', {
    allowNull: true
  });

  // Alter the tenant_id column to allow NULL values in device_auth_challenges
  pgm.alterColumn('device_auth_challenges', 'tenant_id', {
    allowNull: true
  });
};

/**
 * Rollback changes - make tenant_id NOT NULL again
 */
exports.down = pgm => {
  // This might fail if there are any NULL values in the tenant_id column
  pgm.alterColumn('device_registrations', 'tenant_id', {
    allowNull: false
  });

  pgm.alterColumn('device_auth_challenges', 'tenant_id', {
    allowNull: false
  });
};