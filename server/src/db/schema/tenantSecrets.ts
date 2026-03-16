import { pgTable, uuid, varchar, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.ts';
import { users } from './users.ts';

export const tenantSecrets = pgTable('tenant_secrets', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  encryptedValue: text('encrypted_value').notNull(),
  domain: varchar('domain', { length: 255 }),
  description: text('description'),
  createdById: uuid('created_by_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('tenant_secrets_tenant_name_idx').on(table.tenantId, table.name),
]);
