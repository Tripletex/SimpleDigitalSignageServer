/**
 * Tests for TASK-017: Rate limiting on authentication and device-auth endpoints.
 *
 * Strategy: Inspect Express router stacks to verify that rate-limiting middleware
 * is attached to the correct routes. A rate limiter created by express-rate-limit
 * attaches `resetKey` and `getKey` properties to its middleware function, which
 * we use as the detection signal.
 */

// Mock controllers to prevent database/service initialization on import.
// We only need the routers to load -- controllers never execute in these tests.
jest.mock('../../controllers/authController', () => ({
  __esModule: true,
  default: {
    registerUser: jest.fn(),
    selfRegister: jest.fn(),
    verifyEmailToken: jest.fn(),
    completeRegistration: jest.fn(),
    getRegistrationOptions: jest.fn(),
    verifyRegistration: jest.fn(),
    getAuthenticationOptions: jest.fn(),
    verifyAuthentication: jest.fn(),
    getCurrentUser: jest.fn(),
    logout: jest.fn(),
  },
}));

jest.mock('../../controllers/deviceAuthController', () => ({
  __esModule: true,
  default: {
    generateChallenge: jest.fn(),
    verifyChallenge: jest.fn(),
    debugVerify: jest.fn(),
  },
}));

// Mock auth middleware to prevent session/db dependencies
jest.mock('../../middleware/authMiddleware', () => ({
  isAuthenticated: jest.fn((_req: any, _res: any, next: any) => next()),
  isAdmin: jest.fn((_req: any, _res: any, next: any) => next()),
}));

import { Router } from 'express';

// Import routers after mocks are in place
import authRouter from '../authRoutes';
import deviceAuthRouter from '../deviceAuthRoutes';

// ---------- helpers ----------

interface RouteLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: Function & { resetKey?: Function; getKey?: Function } }>;
  };
  handle: Function & { resetKey?: Function; getKey?: Function };
  name?: string;
}

/**
 * Detect whether any middleware in a route's stack was created by express-rate-limit.
 * express-rate-limit attaches `resetKey` and `getKey` to the middleware function.
 */
function isRateLimitMiddleware(fn: Function & { resetKey?: Function; getKey?: Function }): boolean {
  return typeof fn.resetKey === 'function' && typeof fn.getKey === 'function';
}

/**
 * Find a route layer matching the given method and path, then check whether
 * any of its middleware handlers are rate limiters.
 *
 * Express routers store route layers in router.stack. Each layer either:
 *   (a) has a `.route` (path-specific middleware chain), or
 *   (b) is a general-use middleware (no `.route`).
 *
 * For route-level rate limiters applied like:
 *   router.post('/path', rateLimiter, handler)
 * the rate limiter appears inside layer.route.stack.
 *
 * For router-level rate limiters applied like:
 *   router.use(rateLimiter)
 * the rate limiter appears as a top-level layer without `.route`.
 */
function routeHasRateLimiter(
  router: Router,
  method: string,
  path: string,
): boolean {
  const stack = (router as any).stack as RouteLayer[];

  for (const layer of stack) {
    // Check route-level middleware
    if (layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
      for (const routeHandler of layer.route.stack) {
        if (isRateLimitMiddleware(routeHandler.handle)) {
          return true;
        }
      }
    }

    // Check router-level middleware (no .route means it applies to all routes)
    if (!layer.route && isRateLimitMiddleware(layer.handle)) {
      return true;
    }
  }

  return false;
}

// ---------- tests ----------

describe('TASK-017: Rate limiting on auth endpoints', () => {
  /**
   * Scenario 1: POST /webauthn/authentication-options has rate limiting
   */
  it('should have rate limiting on POST /webauthn/authentication-options', () => {
    expect(routeHasRateLimiter(authRouter, 'post', '/webauthn/authentication-options')).toBe(true);
  });

  /**
   * Scenario 2: POST /webauthn/authenticate has rate limiting
   */
  it('should have rate limiting on POST /webauthn/authenticate', () => {
    expect(routeHasRateLimiter(authRouter, 'post', '/webauthn/authenticate')).toBe(true);
  });

  /**
   * Scenario 3: POST /self-register has rate limiting
   */
  it('should have rate limiting on POST /self-register', () => {
    expect(routeHasRateLimiter(authRouter, 'post', '/self-register')).toBe(true);
  });

  /**
   * Scenario 4: GET /verify-email/:token has rate limiting
   */
  it('should have rate limiting on GET /verify-email/:token', () => {
    expect(routeHasRateLimiter(authRouter, 'get', '/verify-email/:token')).toBe(true);
  });

  /**
   * Scenario 7: Authenticated endpoints do NOT have rate limiting
   */
  describe('authenticated endpoints should NOT have rate limiting', () => {
    it('GET /me has no rate limiter', () => {
      expect(routeHasRateLimiter(authRouter, 'get', '/me')).toBe(false);
    });

    it('POST /logout has no rate limiter', () => {
      expect(routeHasRateLimiter(authRouter, 'post', '/logout')).toBe(false);
    });

    it('POST /webauthn/register has no rate limiter', () => {
      expect(routeHasRateLimiter(authRouter, 'post', '/webauthn/register')).toBe(false);
    });

    it('GET /webauthn/registration-options has no rate limiter', () => {
      expect(routeHasRateLimiter(authRouter, 'get', '/webauthn/registration-options')).toBe(false);
    });
  });
});

describe('TASK-017: Rate limiting on device-auth endpoints', () => {
  /**
   * Scenario 5: POST /challenge has rate limiting
   */
  it('should have rate limiting on POST /challenge', () => {
    expect(routeHasRateLimiter(deviceAuthRouter, 'post', '/challenge')).toBe(true);
  });

  /**
   * Scenario 6: POST /verify has rate limiting
   */
  it('should have rate limiting on POST /verify', () => {
    expect(routeHasRateLimiter(deviceAuthRouter, 'post', '/verify')).toBe(true);
  });
});
