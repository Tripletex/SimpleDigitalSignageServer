import { pgTable, uuid, varchar, text, timestamp, boolean, integer, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.ts';
import { tenants } from './tenants.ts';

export const devices = pgTable('devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  claimedById: uuid('claimed_by_id').references(() => users.id),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  displayName: varchar('display_name', { length: 255 }),
  displayCount: integer('display_count').notNull().default(0),
  displays: jsonb('displays').$type<Array<{ name: string; connected: boolean; primary: boolean; resolution?: string }>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const deviceDisplayCampaigns = pgTable('device_display_campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  hardwareId: varchar('hardware_id', { length: 255 }),
  campaignId: uuid('campaign_id').notNull(),  // FK to playlist_groups, added in relations
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('device_display_campaigns_device_display_idx').on(table.deviceId, table.displayName),
]);

export const deviceNetworks = pgTable('device_networks', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull().references(() => devices.id),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: varchar('name', { length: 255 }).notNull(),
  ipAddresses: text('ip_addresses').array().notNull().default([]),  // TEXT[] with default empty array
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const deviceRegistrations = pgTable('device_registrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull().references(() => devices.id),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  deviceType: varchar('device_type', { length: 255 }),
  hardwareId: varchar('hardware_id', { length: 255 }),
  publicKey: text('public_key').notNull(),
  registrationTime: timestamp('registration_time', { withTimezone: true }).notNull().defaultNow(),
  lastSeen: timestamp('last_seen', { withTimezone: true }).notNull().defaultNow(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const deviceAuthChallenges = pgTable('device_auth_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull().references(() => devices.id),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  challenge: text('challenge').notNull(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
  used: boolean('used').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const deviceApiKeys = pgTable('device_api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').notNull().references(() => devices.id),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  apiKeyHash: varchar('api_key_hash', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  lastUsed: timestamp('last_used', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
