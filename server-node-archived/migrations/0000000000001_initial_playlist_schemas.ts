import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

/**
 * Create tables for everything playlist related.
 *
 * @param pgm MigrationBuilder
 */
export async function up(pgm: MigrationBuilder): Promise<void> {

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
    tenant_id: {
      type: 'uuid',
      references: 'tenants',
      onDelete: 'CASCADE',
      notNull: true
    },
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
    tenant_id: {
      type: 'uuid',
      references: 'tenants',
      onDelete: 'CASCADE',
      notNull: true
    },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createIndex('playlists', 'created_by_id');
  pgm.createIndex('playlists', 'tenant_id');
  pgm.createIndex('playlist_items', 'playlist_id');
  pgm.createIndex('playlist_items', 'tenant_id');
  pgm.createIndex('playlist_groups', 'created_by_id');
  pgm.createIndex('playlist_groups', 'tenant_id');
  pgm.createIndex('playlist_schedules', 'playlist_group_id');
  pgm.createIndex('playlist_schedules', 'playlist_id');
  pgm.createIndex('playlist_schedules', 'tenant_id');

}

export function down(pgm: MigrationBuilder): void {

  pgm.dropTable('playlist_schedules');
  pgm.dropTable('playlist_items');
  pgm.dropTable('playlists');
  pgm.dropTable('playlist_groups');

}