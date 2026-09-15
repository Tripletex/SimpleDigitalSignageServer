import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('enum_users_role', ['admin', 'user']);
export const tenantRoleEnum = pgEnum('enum_tenant_members_role', ['owner', 'admin', 'member']);
export const tenantMemberStatusEnum = pgEnum('enum_tenant_members_status', ['active', 'pending']);
export const pendingInvitationRoleEnum = pgEnum('enum_pending_invitations_role', ['owner', 'admin', 'member']);
