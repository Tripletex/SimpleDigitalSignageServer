import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder): void {
  // Add tenant_id to device_networks table
  pgm.addColumn('device_networks', {
    tenant_id: {
      type: 'uuid',
      references: 'tenants',
      onDelete: 'CASCADE',
      // Initially null, will be populated with device's tenant_id
      notNull: false
    }
  });

  // Add tenant_id to device_registrations table
  pgm.addColumn('device_registrations', {
    tenant_id: {
      type: 'uuid',
      references: 'tenants',
      onDelete: 'CASCADE',
      // Initially null, will be populated with device's tenant_id
      notNull: false
    }
  });

  // Add tenant_id to device_auth_challenges table
  pgm.addColumn('device_auth_challenges', {
    tenant_id: {
      type: 'uuid',
      references: 'tenants',
      onDelete: 'CASCADE',
      // Initially null, will be populated with device's tenant_id
      notNull: false
    }
  });

  // Add tenant_id to playlist_items table
  pgm.addColumn('playlist_items', {
    tenant_id: {
      type: 'uuid',
      references: 'tenants',
      onDelete: 'CASCADE',
      // Initially null, will be populated with playlist's tenant_id
      notNull: false
    }
  });

  // Add tenant_id to playlist_schedules table
  pgm.addColumn('playlist_schedules', {
    tenant_id: {
      type: 'uuid',
      references: 'tenants',
      onDelete: 'CASCADE',
      // Initially null, will be populated from playlist_group's tenant_id
      notNull: false
    }
  });

  // Note about authenticators:
  // Authenticators are user-based and not directly tied to a tenant.
  // Users can belong to multiple tenants, and their authenticators are not tenant-specific.
  // Therefore, we're not adding a tenant_id column to the authenticators table.

  // Create indexes for the new tenant_id columns for performance
  pgm.createIndex('device_networks', 'tenant_id');
  pgm.createIndex('device_registrations', 'tenant_id');
  pgm.createIndex('device_auth_challenges', 'tenant_id');
  pgm.createIndex('playlist_items', 'tenant_id');
  pgm.createIndex('playlist_schedules', 'tenant_id');

  // Populate the tenant_id values from parent tables
  
  // Update device_networks from their parent devices
  pgm.sql(`
    UPDATE device_networks dn
    SET tenant_id = d.tenant_id
    FROM devices d
    WHERE dn.device_id = d.id AND d.tenant_id IS NOT NULL
  `);

  // Update device_registrations from their parent devices
  pgm.sql(`
    UPDATE device_registrations dr
    SET tenant_id = d.tenant_id
    FROM devices d
    WHERE dr.device_id = d.id AND d.tenant_id IS NOT NULL
  `);

  // Update device_auth_challenges from their parent devices
  pgm.sql(`
    UPDATE device_auth_challenges dc
    SET tenant_id = d.tenant_id
    FROM devices d
    WHERE dc.device_id = d.id AND d.tenant_id IS NOT NULL
  `);

  // Update playlist_items from their parent playlists
  pgm.sql(`
    UPDATE playlist_items pi
    SET tenant_id = p.tenant_id
    FROM playlists p
    WHERE pi.playlist_id = p.id
  `);

  // Update playlist_schedules from the playlist_groups
  pgm.sql(`
    UPDATE playlist_schedules ps
    SET tenant_id = pg.tenant_id
    FROM playlist_groups pg
    WHERE ps.playlist_group_id = pg.id
  `);

  // Set NOT NULL constraint after populating data
  pgm.alterColumn('device_networks', 'tenant_id', { notNull: true });
  pgm.alterColumn('device_registrations', 'tenant_id', { notNull: true });
  pgm.alterColumn('device_auth_challenges', 'tenant_id', { notNull: true });
  pgm.alterColumn('playlist_items', 'tenant_id', { notNull: true });
  pgm.alterColumn('playlist_schedules', 'tenant_id', { notNull: true });
  // Don't set authenticators.tenant_id to NOT NULL since some authenticators may not be tenant-specific
}

export function down(pgm: MigrationBuilder): void {
  // Drop the indexes first
  pgm.dropIndex('device_networks', 'tenant_id');
  pgm.dropIndex('device_registrations', 'tenant_id');
  pgm.dropIndex('device_auth_challenges', 'tenant_id');
  pgm.dropIndex('playlist_items', 'tenant_id');
  pgm.dropIndex('playlist_schedules', 'tenant_id');
  
  // Drop the tenant_id columns
  pgm.dropColumn('device_networks', 'tenant_id');
  pgm.dropColumn('device_registrations', 'tenant_id');
  pgm.dropColumn('device_auth_challenges', 'tenant_id');
  pgm.dropColumn('playlist_items', 'tenant_id');
  pgm.dropColumn('playlist_schedules', 'tenant_id');
  
  // Note: We don't need to drop anything for authenticators since we didn't add a tenant_id column to it
}
