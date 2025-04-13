import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder): void {
  // Add last_login column to users table
  pgm.addColumn('users', {
    last_login: {
      type: 'timestamp',
      default: null
    }
  });

  // Create an index on the last_login column for potential future queries
  pgm.createIndex('users', 'last_login');
}

export function down(pgm: MigrationBuilder): void {
  // Drop the index first
  pgm.dropIndex('users', 'last_login');
  
  // Then drop the column
  pgm.dropColumn('users', 'last_login');
}