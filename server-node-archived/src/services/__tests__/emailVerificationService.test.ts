/**
 * Tests for TASK-012: Email verification token invalidation after use.
 *
 * These tests verify that verifyEmailToken() consumes (deletes) the token
 * on first successful use, preventing replay attacks.
 */

// Mock the EmailVerification model before importing the service
jest.mock('../../models/EmailVerification', () => {
  const mockDestroy = jest.fn().mockResolvedValue(undefined);

  const mockInstance = {
    email: 'test@example.com',
    isFirstUser: false,
    invitingTenantId: null as string | null,
    invitedRole: null as string | null,
    token: 'abc123tokenvalue',
    expiresAt: new Date(Date.now() + 86400000), // 24h from now
    destroy: mockDestroy,
  };

  const mockFindOne = jest.fn();
  const mockModelCreate = jest.fn();
  const mockModelDestroy = jest.fn();

  return {
    EmailVerification: {
      findOne: mockFindOne,
      create: mockModelCreate,
      destroy: mockModelDestroy,
      generateToken: jest.fn().mockReturnValue('newgeneratedtoken123'),
    },
    __mockInstance: mockInstance,
    __mockFindOne: mockFindOne,
    __mockModelCreate: mockModelCreate,
    __mockModelDestroy: mockModelDestroy,
    __mockInstanceDestroy: mockDestroy,
  };
});

// Import after mocking
import emailVerificationService from '../emailVerificationService';
const {
  __mockInstance: mockInstance,
  __mockFindOne: mockFindOne,
  __mockModelCreate: mockModelCreate,
  __mockInstanceDestroy: mockInstanceDestroy,
} = jest.requireMock('../../models/EmailVerification');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('emailVerificationService.verifyEmailToken', () => {
  /**
   * Scenario 1: Token consumed on first use
   *
   * Given: An EmailVerification record exists with a valid token
   * When: verifyEmailToken(token) is called
   * Then: Returns verification data AND the token row is destroyed
   */
  test('should delete the token from the database after successful verification', async () => {
    // Arrange: findOne returns a valid record
    mockFindOne.mockResolvedValueOnce({ ...mockInstance, destroy: mockInstanceDestroy });

    // Act
    const result = await emailVerificationService.verifyEmailToken('abc123tokenvalue');

    // Assert: returns verification data
    expect(result).not.toBeNull();
    expect(result!.email).toBe('test@example.com');
    expect(result!.isFirstUser).toBe(false);
    expect(result!.isInvitation).toBe(false);

    // Assert: token row was destroyed (THIS SHOULD FAIL -- current code does NOT destroy)
    expect(mockInstanceDestroy).toHaveBeenCalledTimes(1);
  });

  /**
   * Scenario 2: Replayed (already-consumed) token rejected
   *
   * Given: A token was already consumed by a prior verifyEmailToken() call
   * When: verifyEmailToken(token) is called again
   * Then: Returns null
   */
  test('should return null for a replayed (already-consumed) token', async () => {
    // First call: token exists, gets consumed
    mockFindOne.mockResolvedValueOnce({ ...mockInstance, destroy: mockInstanceDestroy });

    const firstResult = await emailVerificationService.verifyEmailToken('abc123tokenvalue');
    expect(firstResult).not.toBeNull();

    // Second call: token no longer exists (was destroyed)
    mockFindOne.mockResolvedValueOnce(null);

    const secondResult = await emailVerificationService.verifyEmailToken('abc123tokenvalue');

    // Assert: second call returns null
    expect(secondResult).toBeNull();

    // Assert: destroy was called during first verification (THIS SHOULD FAIL)
    expect(mockInstanceDestroy).toHaveBeenCalledTimes(1);
  });

  /**
   * Scenario 3: Invitation token consumed on first use
   *
   * Given: An EmailVerification record with invitingTenantId set
   * When: verifyEmailToken(token) is called
   * Then: Returns data with isInvitation: true AND token row is destroyed
   * And: A second call returns null
   */
  test('should consume invitation tokens the same way as regular tokens', async () => {
    const invitationInstance = {
      ...mockInstance,
      invitingTenantId: 'tenant-uuid-123',
      invitedRole: 'Member',
      destroy: mockInstanceDestroy,
    };

    // First call: invitation token exists
    mockFindOne.mockResolvedValueOnce(invitationInstance);

    const result = await emailVerificationService.verifyEmailToken('abc123tokenvalue');

    // Assert: returns invitation data
    expect(result).not.toBeNull();
    expect(result!.isInvitation).toBe(true);
    expect(result!.invitingTenantId).toBe('tenant-uuid-123');
    expect(result!.invitedRole).toBe('Member');

    // Assert: token row was destroyed (THIS SHOULD FAIL)
    expect(mockInstanceDestroy).toHaveBeenCalledTimes(1);

    // Second call: token no longer exists
    mockFindOne.mockResolvedValueOnce(null);
    const secondResult = await emailVerificationService.verifyEmailToken('abc123tokenvalue');
    expect(secondResult).toBeNull();
  });

  /**
   * Scenario 4: New token issuable after consumption
   *
   * Given: A token for test@example.com was consumed
   * When: createEmailVerificationToken('test@example.com') is called
   * Then: A new token is created (consumed token doesn't block it)
   */
  test('should allow creating a new token after the previous one was consumed', async () => {
    // First: verify and consume the existing token
    mockFindOne.mockResolvedValueOnce({ ...mockInstance, destroy: mockInstanceDestroy });
    await emailVerificationService.verifyEmailToken('abc123tokenvalue');

    // Now create a new token -- findOne returns null (no existing valid token)
    mockFindOne.mockResolvedValueOnce(null);
    mockModelCreate.mockResolvedValueOnce({
      token: 'newgeneratedtoken123',
      email: 'test@example.com',
    });

    const newToken = await emailVerificationService.createEmailVerificationToken('test@example.com');

    // Assert: a new token was created
    expect(newToken).toBe('newgeneratedtoken123');
    expect(mockModelCreate).toHaveBeenCalledTimes(1);
  });
});
