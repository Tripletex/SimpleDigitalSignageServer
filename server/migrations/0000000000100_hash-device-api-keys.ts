import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * Migration: Hash device API keys with SHA-256 before storage.
 *
 * This migration replaces the plaintext `api_key` column with an
 * `api_key_hash` column containing SHA-256 hex digests. Existing
 * plaintext keys are hashed in-place using pgcrypto. After this
 * migration, plaintext API keys are no longer stored in the database.
 *
 * The Node.js application must hash incoming API keys with SHA-256
 * before querying: crypto.createHash('sha256').update(key).digest('hex')
 * This produces the same output as PostgreSQL's encode(digest(key, 'sha256'), 'hex')
 * for ASCII hex strings (which is what crypto.randomBytes(32).toString('hex') produces).
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  // Ensure pgcrypto is available for the digest() function
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  // Step 1: Add the new api_key_hash column (nullable initially so we can populate it)
  pgm.addColumn('device_api_keys', {
    api_key_hash: {
      type: 'text',
      notNull: false,
    },
  });

  // Step 2: Hash all existing plaintext api_key values into api_key_hash
  pgm.sql(`
    UPDATE device_api_keys
    SET api_key_hash = encode(digest(api_key, 'sha256'), 'hex')
    WHERE api_key IS NOT NULL AND api_key_hash IS NULL
  `);

  // Step 3: Make api_key_hash NOT NULL now that all rows are populated
  pgm.alterColumn('device_api_keys', 'api_key_hash', {
    notNull: true,
  });

  // Step 4: Drop the unique index created by createIndex in migration 0000000000002 line 182
  // node-pg-migrate generates: {table}_{col}_unique_index
  pgm.dropIndex('device_api_keys', 'api_key', {
    name: 'device_api_keys_api_key_unique_index',
    ifExists: true,
  });

  // Step 5: Drop the unique constraint created by column-level unique: true in createTable
  // PostgreSQL auto-names this: {table}_{column}_key
  pgm.sql('ALTER TABLE device_api_keys DROP CONSTRAINT IF EXISTS device_api_keys_api_key_key');

  // Step 6: Drop the plaintext api_key column
  pgm.dropColumn('device_api_keys', 'api_key');

  // Step 7: Add unique index on api_key_hash for lookup performance
  pgm.createIndex('device_api_keys', 'api_key_hash', { unique: true });
}

/**
 * Down migration: re-add the api_key column and drop api_key_hash.
 *
 * NOTE: Original plaintext API keys cannot be recovered from their SHA-256
 * hashes. After rolling back, existing rows will have NULL api_key values.
 * New API keys must be generated for all devices.
 */
export function down(pgm: MigrationBuilder): void {
  // Drop the unique index on api_key_hash
  pgm.dropIndex('device_api_keys', 'api_key_hash', {
    name: 'device_api_keys_api_key_hash_unique_index',
    ifExists: true,
  });

  // Drop the api_key_hash column
  pgm.dropColumn('device_api_keys', 'api_key_hash');

  // Re-add the api_key column (nullable because we cannot restore plaintext values)
  pgm.addColumn('device_api_keys', {
    api_key: {
      type: 'text',
      notNull: false,
      unique: true,
    },
  });

  // Re-add the explicit unique index on api_key
  pgm.createIndex('device_api_keys', 'api_key', { unique: true });
}
