import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder): void {
  // Create device_health_status enum type
  pgm.createType('device_health_status', [
    'HEALTHY', 
    'WARNING', 
    'ERROR', 
    'OFFLINE', 
    'UNKNOWN'
  ]);

  // Add health status columns to devices table
  pgm.addColumns('devices', {
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
    }
  });

  // Create index for health status for efficient filtering
  pgm.createIndex('devices', 'health_status');
  pgm.createIndex('devices', 'last_health_check');
}

export function down(pgm: MigrationBuilder): void {
  // Drop indexes first
  pgm.dropIndex('devices', 'health_status');
  pgm.dropIndex('devices', 'last_health_check');
  
  // Drop columns from devices table
  pgm.dropColumns('devices', [
    'health_status', 
    'last_health_check', 
    'health_details'
  ]);
  
  // Drop the enum type
  pgm.dropType('device_health_status');
}
