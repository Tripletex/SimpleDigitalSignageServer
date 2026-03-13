/**
 * Tests for TASK-015: Cache invalidation on tenant membership mutations.
 *
 * These tests verify that tenantService calls cacheManager.clearUser()
 * and cacheManager.clearTenant() after every mutation that changes
 * membership state, so that stale cached permissions are immediately
 * purged instead of persisting for the 5-minute TTL.
 */

import { TenantRole, TenantMemberStatus } from '../../../../shared/src/tenantData';

// --- Mock setup (must precede service import) ---

const mockClearUser = jest.fn();
const mockClearTenant = jest.fn();
const mockClearAll = jest.fn();

jest.mock('../../middleware/tenantAuthorizationMiddleware', () => ({
  cacheManager: {
    clearUser: mockClearUser,
    clearTenant: mockClearTenant,
    clearAll: mockClearAll,
  },
}));

const mockGetTenantMember = jest.fn();
const mockUpdateTenantMemberRole = jest.fn();
const mockRemoveTenantMember = jest.fn();
const mockGetTenantById = jest.fn();
const mockAddTenantMember = jest.fn();
const mockDeleteTenant = jest.fn();
const mockCreateTenant = jest.fn();
const mockGetUserTenants = jest.fn();
const mockGetTenantMembers = jest.fn();
const mockCreatePersonalTenantIfNeeded = jest.fn();
const mockUpdateTenant = jest.fn();

jest.mock('../../repositories/tenantRepository', () => ({
  __esModule: true,
  default: {
    getTenantMember: mockGetTenantMember,
    updateTenantMemberRole: mockUpdateTenantMemberRole,
    removeTenantMember: mockRemoveTenantMember,
    getTenantById: mockGetTenantById,
    addTenantMember: mockAddTenantMember,
    deleteTenant: mockDeleteTenant,
    createTenant: mockCreateTenant,
    getUserTenants: mockGetUserTenants,
    getTenantMembers: mockGetTenantMembers,
    createPersonalTenantIfNeeded: mockCreatePersonalTenantIfNeeded,
    updateTenant: mockUpdateTenant,
  },
}));

const mockGetUserByEmail = jest.fn();
const mockGetUserById = jest.fn();

jest.mock('../../repositories/userRepository', () => ({
  __esModule: true,
  default: {
    getUserByEmail: mockGetUserByEmail,
    getUserById: mockGetUserById,
  },
}));

jest.mock('../userService', () => ({
  __esModule: true,
  default: {},
}));

const mockCreateInvitationToken = jest.fn();

jest.mock('../emailVerificationService', () => ({
  __esModule: true,
  default: {
    createInvitationToken: mockCreateInvitationToken,
  },
}));

// Import after all mocks are registered
import tenantService from '../tenantService';

// --- Test data ---

const TENANT_ID = 'tenant-uuid-001';
const OWNER_USER_ID = 'user-uuid-owner';
const TARGET_USER_ID = 'user-uuid-target';
const INVITER_USER_ID = 'user-uuid-inviter';

const ownerMembership = {
  tenantId: TENANT_ID,
  userId: OWNER_USER_ID,
  role: TenantRole.OWNER,
  status: TenantMemberStatus.ACTIVE,
  joinedAt: new Date(),
};

const targetMembership = {
  tenantId: TENANT_ID,
  userId: TARGET_USER_ID,
  role: TenantRole.MEMBER,
  status: TenantMemberStatus.ACTIVE,
  joinedAt: new Date(),
};

const inviterMembership = {
  tenantId: TENANT_ID,
  userId: INVITER_USER_ID,
  role: TenantRole.ADMIN,
  status: TenantMemberStatus.ACTIVE,
  joinedAt: new Date(),
};

const sharedTenant = {
  id: TENANT_ID,
  name: 'Test Tenant',
  isPersonal: false,
  ownerId: OWNER_USER_ID,
  createdAt: new Date(),
};

// --- Tests ---

beforeEach(() => {
  jest.clearAllMocks();
});

describe('tenantService cache invalidation', () => {

  /**
   * Scenario 1: updateMemberRole calls cacheManager.clearUser(targetUserId)
   *
   * Given: Updater is OWNER, target is a MEMBER
   * When: updateMemberRole is called to change target's role
   * Then: cacheManager.clearUser(targetUserId) is called exactly once
   */
  test('updateMemberRole should invalidate cache for the target user', async () => {
    // Arrange
    mockGetTenantMember
      .mockResolvedValueOnce(ownerMembership)   // updater check
      .mockResolvedValueOnce(targetMembership);  // target check
    mockGetTenantById.mockResolvedValueOnce(sharedTenant);
    mockUpdateTenantMemberRole.mockResolvedValueOnce({ ...targetMembership, role: TenantRole.ADMIN });

    // Act
    await tenantService.updateMemberRole(TENANT_ID, OWNER_USER_ID, TARGET_USER_ID, TenantRole.ADMIN);

    // Assert: cache invalidation was called for the target user
    expect(mockClearUser).toHaveBeenCalledTimes(1);
    expect(mockClearUser).toHaveBeenCalledWith(TARGET_USER_ID);
  });

  /**
   * Scenario 2: removeMember calls cacheManager.clearUser(targetUserId)
   *
   * Given: Remover is OWNER, target is MEMBER (not owner)
   * When: removeMember is called
   * Then: cacheManager.clearUser(targetUserId) is called exactly once
   */
  test('removeMember should invalidate cache for the removed user', async () => {
    // Arrange
    mockGetTenantMember
      .mockResolvedValueOnce(ownerMembership)   // remover check
      .mockResolvedValueOnce(targetMembership);  // target check
    mockGetTenantById.mockResolvedValueOnce(sharedTenant);
    mockRemoveTenantMember.mockResolvedValueOnce(true);

    // Act
    await tenantService.removeMember(TENANT_ID, OWNER_USER_ID, TARGET_USER_ID);

    // Assert: cache invalidation was called for the removed user
    expect(mockClearUser).toHaveBeenCalledTimes(1);
    expect(mockClearUser).toHaveBeenCalledWith(TARGET_USER_ID);
  });

  /**
   * Scenario 3: leaveTenant calls cacheManager.clearUser(userId)
   *
   * Given: User is a MEMBER (not owner), tenant is not personal
   * When: leaveTenant is called
   * Then: cacheManager.clearUser(userId) is called exactly once
   */
  test('leaveTenant should invalidate cache for the departing user', async () => {
    // Arrange
    mockGetTenantMember.mockResolvedValueOnce(targetMembership);
    mockGetTenantById.mockResolvedValueOnce(sharedTenant);
    mockRemoveTenantMember.mockResolvedValueOnce(true);

    // Act
    await tenantService.leaveTenant(TENANT_ID, TARGET_USER_ID);

    // Assert: cache invalidation was called for the departing user
    expect(mockClearUser).toHaveBeenCalledTimes(1);
    expect(mockClearUser).toHaveBeenCalledWith(TARGET_USER_ID);
  });

  /**
   * Scenario 4: deleteTenant calls cacheManager.clearTenant(tenantId)
   *
   * Given: User is OWNER, tenant is not personal
   * When: deleteTenant is called
   * Then: cacheManager.clearTenant(tenantId) is called exactly once
   */
  test('deleteTenant should invalidate cache for the entire tenant', async () => {
    // Arrange
    mockGetTenantMember.mockResolvedValueOnce(ownerMembership);
    mockGetTenantById.mockResolvedValueOnce(sharedTenant);
    mockDeleteTenant.mockResolvedValueOnce(true);

    // Act
    await tenantService.deleteTenant(TENANT_ID, OWNER_USER_ID);

    // Assert: tenant-wide cache invalidation was called
    expect(mockClearTenant).toHaveBeenCalledTimes(1);
    expect(mockClearTenant).toHaveBeenCalledWith(TENANT_ID);
  });

  /**
   * Scenario 5: inviteUserToTenant (existing user) calls cacheManager.clearUser(user.id)
   *
   * Given: Inviter is ADMIN, invited email belongs to an existing user who is NOT a member
   * When: inviteUserToTenant is called
   * Then: cacheManager.clearUser(existingUser.id) is called exactly once
   */
  test('inviteUserToTenant (existing user) should invalidate cache for the invited user', async () => {
    const existingUser = { id: 'user-uuid-existing', email: 'existing@example.com', displayName: 'Existing User' };

    // Arrange
    mockGetTenantMember
      .mockResolvedValueOnce(inviterMembership)  // inviter permission check
      .mockResolvedValueOnce(null);              // target is NOT already a member
    mockGetTenantById.mockResolvedValueOnce(sharedTenant);
    mockGetUserByEmail.mockResolvedValueOnce(existingUser);
    mockAddTenantMember.mockResolvedValueOnce(undefined);

    // Act
    await tenantService.inviteUserToTenant(TENANT_ID, INVITER_USER_ID, 'existing@example.com', TenantRole.MEMBER);

    // Assert: cache invalidation was called for the invited user
    expect(mockClearUser).toHaveBeenCalledTimes(1);
    expect(mockClearUser).toHaveBeenCalledWith(existingUser.id);
  });

  /**
   * Negative scenario: inviteUserToTenant (new user) should NOT call clearUser
   *
   * Given: Email does not belong to any existing user
   * When: inviteUserToTenant creates an invitation token
   * Then: cacheManager.clearUser is NOT called (no user to invalidate)
   */
  test('inviteUserToTenant (new user) should NOT call clearUser', async () => {
    // Arrange
    mockGetTenantMember.mockResolvedValueOnce(inviterMembership);
    mockGetTenantById.mockResolvedValueOnce(sharedTenant);
    mockGetUserByEmail.mockResolvedValueOnce(null); // user does not exist
    mockCreateInvitationToken.mockResolvedValueOnce('invitation-token-abc');

    // Act
    await tenantService.inviteUserToTenant(TENANT_ID, INVITER_USER_ID, 'newuser@example.com', TenantRole.MEMBER);

    // Assert: no cache invalidation for non-existent users
    expect(mockClearUser).not.toHaveBeenCalled();
    expect(mockClearTenant).not.toHaveBeenCalled();
  });
});
