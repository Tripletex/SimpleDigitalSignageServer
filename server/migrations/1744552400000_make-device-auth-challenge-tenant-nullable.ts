const { MigrationBuilder, ColumnDefinitions } = require('node-pg-migrate');

/**
 * Update the device_auth_challenges table to make the tenant_id column nullable
 */
export const up = (pgm: MigrationBuilder) => {
  // Alter the tenant_id column to allow NULL values
  pgm.alterColumn('device_auth_challenges', 'tenant_id', {
    allowNull: true
  });
};

/**
 * Rollback changes - make tenant_id NOT NULL again
 */
export const down = (pgm: MigrationBuilder) => {
  // This might fail if there are any NULL values in the tenant_id column
  pgm.alterColumn('device_auth_challenges', 'tenant_id', {
    allowNull: false
  });
};