/**
 * CSRF-aware fetch wrapper (TASK-004).
 *
 * Lazily fetches a CSRF token from /api/auth/csrf-token on the first
 * state-changing request (POST, PUT, DELETE, PATCH). The token is cached
 * in-memory and sent as the x-csrf-token header on every mutation.
 *
 * If the server responds with a CSRF-specific 403 (token missing/invalid),
 * the token is refreshed once and the request is retried automatically.
 * Non-CSRF 403s (authorization denied) are returned directly to the caller.
 */

let csrfToken: string | null = null;

// Messages returned by the server's CSRF middleware (csrfMiddleware.ts)
const CSRF_ERROR_MESSAGES = ['CSRF token missing', 'CSRF token invalid'];

async function fetchCsrfToken(): Promise<string> {
  const response = await fetch('/api/auth/csrf-token', {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch CSRF token: ${response.status}`);
  }

  const data = await response.json();
  csrfToken = data.csrfToken;
  return csrfToken!;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function csrfFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();

  // Safe methods don't need a CSRF token
  if (SAFE_METHODS.has(method)) {
    return fetch(input, { ...init, credentials: 'include' });
  }

  // Ensure we have a token
  if (!csrfToken) {
    await fetchCsrfToken();
  }

  const headers = new Headers(init?.headers);
  headers.set('x-csrf-token', csrfToken!);

  const response = await fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });

  // On 403, check if it's a CSRF error before retrying
  if (response.status === 403) {
    try {
      // Clone so the caller can still read the body if we don't retry
      const cloned = response.clone();
      const body = await cloned.json();

      if (!CSRF_ERROR_MESSAGES.includes(body?.message)) {
        // Not a CSRF error (e.g. authorization denied) -- return as-is
        return response;
      }

      // CSRF token stale -- refresh and retry once
      csrfToken = null;
      await fetchCsrfToken();
      headers.set('x-csrf-token', csrfToken!);
      return fetch(input, {
        ...init,
        headers,
        credentials: 'include',
      });
    } catch {
      // If body parsing or token refresh fails, return the original 403
      return response;
    }
  }

  return response;
}
