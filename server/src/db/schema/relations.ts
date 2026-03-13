import { relations } from 'drizzle-orm';
import { users, authenticators, emailVerifications } from './users.ts';
import { tenants, tenantMembers, pendingInvitations } from './tenants.ts';
import { devices, deviceNetworks, deviceRegistrations, deviceAuthChallenges, deviceApiKeys } from './devices.ts';
import { playlists, playlistItems, playlistGroups, playlistSchedules } from './playlists.ts';

// Users relations
export const usersRelations = relations(users, ({ many }) => ({
  authenticators: many(authenticators),
  tenantMembers: many(tenantMembers),
}));

// Authenticators relations
export const authenticatorsRelations = relations(authenticators, ({ one }) => ({
  user: one(users, {
    fields: [authenticators.userId],
    references: [users.id],
  }),
}));

// Tenants relations
export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  owner: one(users, {
    fields: [tenants.ownerId],
    references: [users.id],
  }),
  tenantMembers: many(tenantMembers),
  devices: many(devices),
  pendingInvitations: many(pendingInvitations),
}));

// TenantMembers relations
export const tenantMembersRelations = relations(tenantMembers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantMembers.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [tenantMembers.userId],
    references: [users.id],
  }),
  invitedBy: one(users, {
    fields: [tenantMembers.invitedById],
    references: [users.id],
    relationName: 'invitedByUser',
  }),
}));

// PendingInvitations relations
export const pendingInvitationsRelations = relations(pendingInvitations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pendingInvitations.tenantId],
    references: [tenants.id],
  }),
  invitedBy: one(users, {
    fields: [pendingInvitations.invitedById],
    references: [users.id],
  }),
}));

// Devices relations
export const devicesRelations = relations(devices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [devices.tenantId],
    references: [tenants.id],
  }),
  claimedBy: one(users, {
    fields: [devices.claimedById],
    references: [users.id],
  }),
  campaign: one(playlistGroups, {
    fields: [devices.campaignId],
    references: [playlistGroups.id],
  }),
  networks: many(deviceNetworks),
  registrations: many(deviceRegistrations),
}));

// DeviceNetworks relations
export const deviceNetworksRelations = relations(deviceNetworks, ({ one }) => ({
  device: one(devices, {
    fields: [deviceNetworks.deviceId],
    references: [devices.id],
  }),
  tenant: one(tenants, {
    fields: [deviceNetworks.tenantId],
    references: [tenants.id],
  }),
}));

// DeviceRegistrations relations
export const deviceRegistrationsRelations = relations(deviceRegistrations, ({ one }) => ({
  device: one(devices, {
    fields: [deviceRegistrations.deviceId],
    references: [devices.id],
  }),
  tenant: one(tenants, {
    fields: [deviceRegistrations.tenantId],
    references: [tenants.id],
  }),
}));

// DeviceAuthChallenges relations
export const deviceAuthChallengesRelations = relations(deviceAuthChallenges, ({ one }) => ({
  device: one(devices, {
    fields: [deviceAuthChallenges.deviceId],
    references: [devices.id],
  }),
  tenant: one(tenants, {
    fields: [deviceAuthChallenges.tenantId],
    references: [tenants.id],
  }),
}));

// DeviceApiKeys relations
export const deviceApiKeysRelations = relations(deviceApiKeys, ({ one }) => ({
  device: one(devices, {
    fields: [deviceApiKeys.deviceId],
    references: [devices.id],
  }),
  tenant: one(tenants, {
    fields: [deviceApiKeys.tenantId],
    references: [tenants.id],
  }),
}));

// Playlists relations
export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [playlists.tenantId],
    references: [tenants.id],
  }),
  createdBy: one(users, {
    fields: [playlists.createdById],
    references: [users.id],
  }),
  items: many(playlistItems),
}));

// PlaylistItems relations
export const playlistItemsRelations = relations(playlistItems, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistItems.playlistId],
    references: [playlists.id],
  }),
  tenant: one(tenants, {
    fields: [playlistItems.tenantId],
    references: [tenants.id],
  }),
}));

// PlaylistGroups relations
export const playlistGroupsRelations = relations(playlistGroups, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [playlistGroups.tenantId],
    references: [tenants.id],
  }),
  createdBy: one(users, {
    fields: [playlistGroups.createdById],
    references: [users.id],
  }),
  schedules: many(playlistSchedules),
}));

// PlaylistSchedules relations
export const playlistSchedulesRelations = relations(playlistSchedules, ({ one }) => ({
  playlistGroup: one(playlistGroups, {
    fields: [playlistSchedules.playlistGroupId],
    references: [playlistGroups.id],
  }),
  playlist: one(playlists, {
    fields: [playlistSchedules.playlistId],
    references: [playlists.id],
  }),
  tenant: one(tenants, {
    fields: [playlistSchedules.tenantId],
    references: [tenants.id],
  }),
}));
