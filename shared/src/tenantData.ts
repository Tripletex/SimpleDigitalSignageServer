// Tenant data types
export enum TenantRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member'
}

export enum TenantMemberStatus {
  ACTIVE = 'active',
  PENDING = 'pending'
}

export interface Tenant {
  id: string;
  name: string;
  isPersonal: boolean;
  createdAt: Date;
}

export interface TenantMember {
  tenantId: string;
  userId: string;
  userEmail?: string; // Useful for UI display
  userDisplayName?: string; // Useful for UI display
  role: TenantRole;
  status: TenantMemberStatus;
  joinedAt: Date;
  invitedBy?: string; // User ID who invited this member
}

export interface TenantCreateRequest {
  name: string;
  isPersonal?: boolean;
}

export interface TenantInviteRequest {
  tenantId: string;
  email: string;
  role: TenantRole;
}

export interface TenantResponse {
  id: string;
  name: string;
  isPersonal: boolean;
  createdAt: string;
  userRole: TenantRole;
  memberCount?: number;
}

export interface TenantMemberResponse {
  userId: string;
  email: string;
  displayName?: string;
  role: TenantRole;
  status: TenantMemberStatus;
  joinedAt: string;
}

export interface TenantDetailResponse {
  id: string;
  name: string;
  isPersonal: boolean;
  createdAt: string;
  userRole: TenantRole; // Role of the requesting user
  members: TenantMemberResponse[];
}