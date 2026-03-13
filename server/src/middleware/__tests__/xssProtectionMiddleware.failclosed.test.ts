import { Request, Response, NextFunction } from 'express';
import { sanitizeInput } from '../xssProtectionMiddleware';

/**
 * Tests for TASK-016: XSS sanitization middleware fail-closed behavior.
 *
 * The middleware must reject requests with HTTP 400 when sanitization
 * encounters an error, rather than passing unsanitized input through.
 */

function createMockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    path: '/test',
    ...overrides,
  } as Request;
}

describe('sanitizeInput - fail-closed behavior (TASK-016)', () => {
  /**
   * Scenario 1: Fail-Closed — Sanitization error returns 400
   *
   * Given: An HTTP request where the sanitizeInput try block throws an error
   * When: The catch block executes
   * Then: The middleware responds with HTTP 400 and JSON { error: 'Invalid input' }
   * And: next() is NOT called
   * And: The error is logged server-side
   */
  it('should return 400 and not call next() when sanitization throws an error', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next: NextFunction = jest.fn();

    // Create a body with a property that throws when enumerated,
    // triggering an error inside sanitizeObject -> Object.entries
    const poisonedBody: Record<string, unknown> = {};
    Object.defineProperty(poisonedBody, 'malicious', {
      get() {
        throw new Error('Sanitization processing error');
      },
      enumerable: true,
    });
    req.body = poisonedBody;

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    sanitizeInput(req, res, next);

    // Must NOT call next — request must not proceed with unsanitized input
    expect(next).not.toHaveBeenCalled();

    // Must respond with 400
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid input' });

    // Must still log the error server-side
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy.mock.calls[0][0]).toContain('[XSS-PROTECTION]');

    consoleSpy.mockRestore();
  });

  /**
   * Scenario 2: Happy Path — Normal request passes through
   *
   * Given: A normal HTTP request with valid body data
   * When: The request passes through sanitizeInput
   * Then: next() is called and the request proceeds normally (no 400)
   */
  it('should call next() normally when sanitization succeeds', () => {
    const req = createMockRequest({
      body: { name: 'Test User', description: 'A simple description' },
    } as Partial<Request>);
    const res = createMockResponse();
    const next: NextFunction = jest.fn();

    sanitizeInput(req, res, next);

    // next() must be called — request proceeds
    expect(next).toHaveBeenCalled();

    // Must NOT send a 400 response
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  /**
   * Scenario 3: No information leakage
   *
   * Given: A sanitization error occurs
   * When: The 400 response is sent
   * Then: The response body contains ONLY { error: 'Invalid input' }
   *       — no stack trace, no error class name, no internal details
   */
  it('should not leak internal error details in the 400 response', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next: NextFunction = jest.fn();

    const poisonedBody: Record<string, unknown> = {};
    Object.defineProperty(poisonedBody, 'malicious', {
      get() {
        throw new Error('INTERNAL: database connection pool exhausted');
      },
      enumerable: true,
    });
    req.body = poisonedBody;

    jest.spyOn(console, 'error').mockImplementation(() => {});

    sanitizeInput(req, res, next);

    // Verify the response body is exactly the generic message
    expect(res.json).toHaveBeenCalledTimes(1);
    const responseBody = (res.json as jest.Mock).mock.calls[0][0];

    // Must be exactly { error: 'Invalid input' } — no extra fields
    expect(Object.keys(responseBody)).toEqual(['error']);
    expect(responseBody.error).toBe('Invalid input');

    // Must NOT contain internal details
    const bodyString = JSON.stringify(responseBody);
    expect(bodyString).not.toContain('INTERNAL');
    expect(bodyString).not.toContain('database');
    expect(bodyString).not.toContain('sanitization');
    expect(bodyString).not.toContain('stack');
    expect(bodyString).not.toContain('Error');

    (console.error as jest.Mock).mockRestore();
  });
});
