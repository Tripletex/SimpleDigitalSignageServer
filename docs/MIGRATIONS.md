# Database Migrations Guide

This project uses [node-pg-migrate](https://github.com/salsita/node-pg-migrate) for database migrations, providing a Flyway-like experience for TypeScript/Node.js.

## Migration Commands

The following npm scripts are available for managing migrations:

```bash
# Check and run pending migrations
npm run db:migrate

# Roll back the most recent migration
npm run db:migrate:down

# Create a new migration file (in TypeScript)
npm run db:migrate:create name-of-migration

# Convert all JavaScript migrations to TypeScript
npm run db:migrate:convert

# Reset the database (drop, create, run all migrations)
npm run db:reset
```

## Automatic Migrations

The server automatically checks for and applies pending migrations during startup. This behavior is implemented in `src/config/checkMigrations.ts` and integrated into the server startup process.

## Migration Files

Migration files are located in the `migrations/` directory and are written in TypeScript for better type safety and integration with the rest of the codebase.

Migration files follow this format:

```typescript
import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export function up(pgm: MigrationBuilder): void {
  // Changes to apply when migrating up
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    // Additional fields...
  });
}

export function down(pgm: MigrationBuilder): void {
  // How to revert the changes when migrating down
  pgm.dropTable('users');
}
```

## Creating a New Migration

To create a new TypeScript migration:

1. Run the creation command:
   ```bash
   npm run db:migrate:create add-new-feature
   ```
   This uses our custom helper script which automatically creates a TypeScript migration file.

2. Edit the created file in the `migrations/` directory:
   ```typescript
   import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

   export const shorthands: ColumnDefinitions | undefined = undefined;

   export function up(pgm: MigrationBuilder): void {
     // Your database changes here
     pgm.createTable('new_table', { /* ... */ });
     pgm.addColumn('existing_table', 'new_column', { type: 'text' });
   }

   export function down(pgm: MigrationBuilder): void {
     // How to undo these changes
     pgm.dropColumn('existing_table', 'new_column');
     pgm.dropTable('new_table');
   }
   ```

## Key Features

- **Versioned Migrations**: Each migration is tracked in the `pgmigrations` table
- **Up/Down Methods**: Support for both applying and rolling back changes
- **Transaction Safety**: Migrations run in transactions by default
- **Sequencing**: Migrations run in order based on timestamp prefixes
- **Idempotency**: Migrations run only once

## Common Migration Operations

### Creating a Table

```typescript
pgm.createTable('table_name', {
  id: { type: 'uuid', primaryKey: true },
  name: { type: 'varchar(255)', notNull: true },
  created_at: { 
    type: 'timestamp', 
    notNull: true, 
    default: pgm.func('current_timestamp') 
  }
});
```

### Adding a Column

```typescript
pgm.addColumn('table_name', 'column_name', {
  type: 'text',
  notNull: false
});
```

### Creating an Index

```typescript
pgm.createIndex('table_name', 'column_name');
// Or composite index:
pgm.createIndex('table_name', ['column1', 'column2'], { unique: true });
```

### Adding a Foreign Key

```typescript
pgm.addConstraint('table_name', 'fk_constraint_name', {
  foreignKeys: {
    columns: 'column_name',
    references: 'referenced_table(referenced_column)',
    onDelete: 'CASCADE'
  }
});
```

### Creating an Enum Type

```typescript
pgm.createType('status_enum', ['ACTIVE', 'PENDING', 'DISABLED']);

// Use in a table
pgm.addColumn('table_name', {
  status: {
    type: 'status_enum',
    notNull: true,
    default: 'PENDING'
  }
});
```

## Best Practices

1. **Always provide a `down` function** that properly reverts the changes made in `up`
2. **Test migrations** before applying them to production
3. **Keep migrations small and focused** on a specific change
4. **Use descriptive filenames** that indicate what the migration does
5. **Never modify an existing migration file** after it has been applied - create a new migration instead
6. **Document complex migrations** with comments

## Migration Tracking

Migrations are tracked in the `pgmigrations` table with the following schema:

- `id`: Serial primary key
- `name`: Name of the migration (filename without extension)
- `run_on`: Timestamp when the migration was applied

The table is automatically created when the first migration is run.