import { pgTable, uuid, varchar, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.ts';
import { tenants } from './tenants.ts';

export const playlists = pgTable('playlists', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  createdById: uuid('created_by_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const playlistItems = pgTable('playlist_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  playlistId: uuid('playlist_id').notNull().references(() => playlists.id),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  position: integer('position').notNull(),
  type: varchar('type', { length: 255 }).notNull(),
  url: jsonb('url'),  // { location: string }
  duration: integer('duration').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const playlistGroups = pgTable('playlist_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  createdById: uuid('created_by_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const playlistSchedules = pgTable('playlist_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  playlistGroupId: uuid('playlist_group_id').notNull().references(() => playlistGroups.id),
  playlistId: uuid('playlist_id').notNull().references(() => playlists.id),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  start: varchar('start', { length: 5 }).notNull(),  // "HH:MM"
  end: varchar('end', { length: 5 }).notNull(),       // "HH:MM"
  days: text('days').array().notNull(),                // ["mon","tue",...]
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
