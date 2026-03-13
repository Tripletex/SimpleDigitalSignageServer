/**
 * Tests for TASK-014: Atomic isFirstUser check in completeRegistration.
 *
 * These tests verify that completeRegistration determines the first-user ADMIN
 * role via an atomic database check (advisory lock + User.count inside a
 * transaction), NOT by trusting the session-stored isFirstUser flag.
 */

// --- Mocks (must be defined before imports) ---

const mockTransaction = jest.fn();
const mockQuery = jest.fn();

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    transaction: mockTransaction,
    query: mockQuery,
  },
}));

const mockCreateUser = jest.fn();
const mockGetUserByEmail = jest.fn();
const mockGetAllUsers = jest.fn();

jest.mock('../../services/userService', () => ({
  __esModule: true,
  default: {
    createUser: mockCreateUser,
    getUserByEmail: mockGetUserByEmail,
    getAllUsers: mockGetAllUsers,
  },
}));

const mockCreatePersonalTenantForUser = jest.fn();

jest.mock('../../services/tenantService', () => ({
  __esModule: true,
  default: {
    createPersonalTenantForUser: mockCreatePersonalTenantForUser,
  },
}));

const mockUserCount = jest.fn();

jest.mock('../../models/User', () => ({
  User: {
    count: mockUserCount,
  },
}));

jest.mock('../../repositories/tenantRepository', () => ({
  __esModule: true,
  default: {
    addTenantMember: jest.fn(),
  },
}));

jest.mock('../../services/emailVerificationService', () => ({
  __esModule: true,
  default: {
    verifyEmailToken: jest.fn(),
    createEmailVerificationToken: jest.fn(),
  },
}));

jest.mock('../../services/webauthnService', () => ({
  __esModule: true,
  default: {
    generateRegistrationOptions: jest.fn(),
    verifyRegistration: jest.fn(),
    generateAuthenticationOptions: jest.fn(),
    verifyAuthentication: jest.fn(),
  },
}));

jest.mock('../../utils/helpers', () => ({
  generateUUID: jest.fn().mockReturnValue('test-uuid-001'),
}));

// --- Imports (after mocks) ---

import authController from '../authController';

// --- Helpers ---

interface MockSession {
  verifiedEmail?: string;
  isFirstUser?: boolean;
  invitingTenantId?: string;
  invitedRole?: string;
  userId?: string;
  username?: string;
  role?: string;
  regenerate: jest.Mock;
  save: jest.Mock;
  destroy: jest.Mock;
}

function createMockReq(sessionOverrides: Partial<MockSession> = {}): any {
  const session: MockSession = {
    regenerate: jest.fn((cb: (err?: Error | null) => void) => cb(null)),
    save: jest.fn((cb: (err?: Error | null) => void) => cb(null)),
    destroy: jest.fn((cb: (err?: Error | null) => void) => cb(null)),
    ...sessionOverrides,
  };
  return {
    session,
    body: { displayName: 'Test User' },
    params: {},
  };
}

function createMockRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

/**
 * Helper: configure mockTransaction to execute the callback and return its result.
 * The callback receives a mock transaction object.
 */
function setupTransaction(): { txn: { LOCK: string } } {
  const txn = { LOCK: 'SHARE' };
  mockTransaction.mockImplementation(async (cb: (t: any) => Promise<any>) => {
    return cb(txn);
  });
  return { txn };
}

// --- Tests ---

beforeEach(() => {
  jest.clearAllMocks();

  // Default: createUser returns a user object
  mockCreateUser.mockResolvedValue({
    id: 'user-001',
    email: 'test@example.com',
    displayName: 'Test User',
    role: 'user',
  });

  // Default: getUserByEmail returns null (no existing user)
  mockGetUserByEmail.mockResolvedValue(null);

  // Default: createPersonalTenantForUser succeeds
  mockCreatePersonalTenantForUser.mockResolvedValue(undefined);

  // Default: advisory lock query succeeds
  mockQuery.mockResolvedValue(undefined);
});

describe('completeRegistration: atomic isFirstUser check', () => {
  /**
   * Scenario 1: First user gets ADMIN role via atomic DB check
   *
   * Given: req.session.verifiedEmail = 'first@example.com'
   *   And: User.count() returns 0 inside the transaction
   * When: completeRegistration is called
   * Then: The user is created with role = 'admin'
   *   And: sequelize.transaction() was called
   *   And: pg_advisory_xact_lock was acquired inside the transaction
   *   And: User.count was called inside the transaction
   */
  test('first user gets ADMIN role via atomic DB check, not session trust', async () => {
    const { txn } = setupTransaction();
    mockUserCount.mockResolvedValue(0);
    mockCreateUser.mockResolvedValue({
      id: 'user-001',
      email: 'first@example.com',
      displayName: 'First User',
      role: 'admin',
    });

    const req = createMockReq({
      verifiedEmail: 'first@example.com',
      isFirstUser: true,
    });
    const res = createMockRes();

    await authController.completeRegistration(req, res);

    // Assert: transaction was used for atomic check
    expect(mockTransaction).toHaveBeenCalledTimes(1);

    // Assert: advisory lock was acquired inside the transaction
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_xact_lock'),
      expect.objectContaining({ transaction: txn }),
    );

    // Assert: User.count was called inside the transaction
    expect(mockUserCount).toHaveBeenCalledWith(
      expect.objectContaining({ transaction: txn }),
    );

    // Assert: user was created with ADMIN role and the transaction was passed
    // displayName comes from req.body.displayName ('Test User' per mock)
    expect(mockCreateUser).toHaveBeenCalledWith(
      'first@example.com',
      'Test User',
      'admin',
      txn,
    );

    // Assert: successful response
    expect(res.status).toHaveBeenCalledWith(201);
  });

  /**
   * Scenario 2: Subsequent user gets USER role
   *
   * Given: req.session.verifiedEmail = 'second@example.com'
   *   And: User.count() returns 1 inside the transaction
   * When: completeRegistration is called
   * Then: The user is created with role = 'user'
   */
  test('subsequent user gets USER role when users already exist', async () => {
    const { txn } = setupTransaction();
    mockUserCount.mockResolvedValue(1);
    mockCreateUser.mockResolvedValue({
      id: 'user-002',
      email: 'second@example.com',
      displayName: 'Second User',
      role: 'user',
    });

    const req = createMockReq({
      verifiedEmail: 'second@example.com',
      isFirstUser: false,
    });
    const res = createMockRes();

    await authController.completeRegistration(req, res);

    // Assert: user was created with USER role and the transaction was passed
    // displayName comes from req.body.displayName ('Test User' per mock)
    expect(mockCreateUser).toHaveBeenCalledWith(
      'second@example.com',
      'Test User',
      'user',
      txn,
    );

    // Assert: successful response
    expect(res.status).toHaveBeenCalledWith(201);
  });

  /**
   * Scenario 3: Stale session isFirstUser=true overridden by DB check
   *
   * THIS IS THE CRITICAL RACE CONDITION TEST.
   *
   * Given: req.session.isFirstUser = true (set when 0 users existed)
   *   And: User.count() returns 1 inside the transaction (another user registered meanwhile)
   * When: completeRegistration is called
   * Then: The user is created with role = 'user' (NOT admin)
   *
   * The current code trusts req.session.isFirstUser and will assign ADMIN.
   * This test MUST fail on the current code.
   */
  test('stale session isFirstUser=true is overridden by atomic DB check', async () => {
    const { txn } = setupTransaction();
    // DB says 1 user exists -- someone else registered first
    mockUserCount.mockResolvedValue(1);
    mockCreateUser.mockResolvedValue({
      id: 'user-003',
      email: 'stale@example.com',
      displayName: 'Stale User',
      role: 'user',
    });

    const req = createMockReq({
      verifiedEmail: 'stale@example.com',
      // Session says first user (STALE data from registration time)
      isFirstUser: true,
    });
    const res = createMockRes();

    await authController.completeRegistration(req, res);

    // Assert: despite session.isFirstUser=true, the DB check determines USER role
    // and the transaction is passed through for atomicity
    expect(mockCreateUser).toHaveBeenCalledWith(
      'stale@example.com',
      expect.any(String),
      'user', // NOT 'admin' -- the atomic DB check overrides the stale session
      txn,
    );
  });

  /**
   * Scenario 4: Session regenerate-set-save-respond pattern preserved
   *
   * Given: A successful completeRegistration call
   * When: User is created
   * Then: req.session.regenerate() is called
   *   And: After regenerate, session fields are set
   *   And: req.session.save() is called
   *   And: Response is sent inside the save callback
   */
  test('preserves session regenerate-set-save-respond pattern', async () => {
    setupTransaction();
    mockUserCount.mockResolvedValue(0);

    const createdUser = {
      id: 'user-004',
      email: 'pattern@example.com',
      displayName: 'Pattern User',
      role: 'admin',
    };
    mockCreateUser.mockResolvedValue(createdUser);

    const req = createMockReq({
      verifiedEmail: 'pattern@example.com',
      isFirstUser: true,
    });
    const res = createMockRes();

    await authController.completeRegistration(req, res);

    // Assert: regenerate was called
    expect(req.session.regenerate).toHaveBeenCalledTimes(1);

    // Assert: save was called after regenerate
    expect(req.session.save).toHaveBeenCalledTimes(1);

    // Assert: session fields were set (verify via the regenerate callback)
    // After regenerate runs, session fields should be set before save
    expect(req.session.userId).toBe('user-004');
    expect(req.session.username).toBe('pattern@example.com');
    expect(req.session.role).toBe('admin');

    // Assert: response was sent (201 with success)
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: expect.stringContaining('Registration completed'),
      }),
    );
  });

  /**
   * Scenario 5: Transaction failure returns 500 (fail closed)
   *
   * Given: sequelize.transaction() throws an error
   * When: completeRegistration is called
   * Then: Response is 500 with a generic error message
   *   And: The user is NOT created
   */
  test('transaction failure returns 500 and does not create user', async () => {
    mockTransaction.mockRejectedValue(new Error('DB connection failure'));

    const req = createMockReq({
      verifiedEmail: 'fail@example.com',
      isFirstUser: true,
    });
    const res = createMockRes();

    await authController.completeRegistration(req, res);

    // Assert: user was NOT created
    expect(mockCreateUser).not.toHaveBeenCalled();

    // Assert: error response (handleErrors catches and returns 500)
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
