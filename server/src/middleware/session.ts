/**
 * PostgreSQL-backed Session Middleware for Hono
 *
 * Replaces express-session with a custom implementation that stores
 * session data in a PostgreSQL table via the raw postgres client.
 */

import type { Context, Next } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { AppEnv, Session, SessionData } from '../types/context.ts';
import { queryClient } from '../db/client.ts';
import { COOKIE_CONFIG, SESSION_SECRET } from '../config/webauthn.ts';
import { env } from '../config/env.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_COOKIE_NAME = 'session_id';
const SESSION_MAX_AGE_MS = COOKIE_CONFIG.maxAge; // 24 hours

// ---------------------------------------------------------------------------
// Table bootstrap
// ---------------------------------------------------------------------------

let tableReady = false;

/**
 * Ensure the sessions table exists. Called once on first request.
 */
async function ensureSessionTable(): Promise<void> {
  if (tableReady) return;

  await queryClient`
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(128) PRIMARY KEY,
      data JSONB NOT NULL DEFAULT '{}',
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  tableReady = true;
}

// ---------------------------------------------------------------------------
// Session ID generation
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically secure session ID.
 * Combines crypto.randomUUID() with additional random bytes for extra entropy.
 */
function generateSessionId(): string {
  const uuid = crypto.randomUUID();
  const extra = new Uint8Array(16);
  crypto.getRandomValues(extra);
  const hexExtra = Array.from(extra, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${uuid}-${hexExtra}`;
}

// ---------------------------------------------------------------------------
// Session CRUD helpers
// ---------------------------------------------------------------------------

async function loadSession(id: string): Promise<SessionData | null> {
  const rows = await queryClient`
    SELECT data, expires_at FROM sessions WHERE id = ${id}
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  const expiresAt = new Date(row.expires_at as string);

  // Check expiry
  if (expiresAt.getTime() < Date.now()) {
    // Expired — delete asynchronously
    deleteSession(id).catch((err) =>
      console.error('[SESSION] Failed to delete expired session:', err),
    );
    return null;
  }

  return row.data as SessionData;
}

async function saveSession(id: string, data: SessionData): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  await queryClient`
    INSERT INTO sessions (id, data, expires_at, updated_at)
    VALUES (${id}, ${JSON.stringify(data)}::jsonb, ${expiresAt.toISOString()}::timestamptz, NOW())
    ON CONFLICT (id) DO UPDATE SET
      data = ${JSON.stringify(data)}::jsonb,
      expires_at = ${expiresAt.toISOString()}::timestamptz,
      updated_at = NOW()
  `;
}

async function deleteSession(id: string): Promise<void> {
  await queryClient`DELETE FROM sessions WHERE id = ${id}`;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Session middleware.
 *
 * 1. Reads `session_id` cookie from the request.
 * 2. Loads existing session from PostgreSQL or creates a new one.
 * 3. Attaches a `Session` object to the Hono context via `c.set('session', ...)`.
 * 4. After the handler runs, persists the session back to the database and
 *    refreshes the cookie.
 */
export async function sessionMiddleware(
  c: Context<AppEnv>,
  next: Next,
): Promise<void> {
  await ensureSessionTable();

  let sessionId = getCookie(c, SESSION_COOKIE_NAME) || '';
  let data: SessionData = {};
  let isNew = false;

  // Attempt to load an existing session
  if (sessionId) {
    const existing = await loadSession(sessionId);
    if (existing) {
      data = existing;
    } else {
      // Cookie exists but session is invalid/expired — create a new one
      sessionId = generateSessionId();
      isNew = true;
    }
  } else {
    sessionId = generateSessionId();
    isNew = true;
  }

  // Track whether the session was explicitly destroyed
  let destroyed = false;

  // Build the Session object
  const session: Session = Object.assign(data as SessionData, {
    id: sessionId,

    async save(): Promise<void> {
      if (destroyed) return;
      // Extract session data (everything except methods and id)
      const { id: _id, save: _s, regenerate: _r, destroy: _d, ...persistData } = session;
      await saveSession(sessionId, persistData);
    },

    async regenerate(): Promise<string> {
      // Delete old session
      await deleteSession(sessionId);

      // Generate new ID and copy data
      const newId = generateSessionId();
      const { id: _id, save: _s, regenerate: _r, destroy: _d, ...persistData } = session;
      sessionId = newId;
      session.id = newId;

      await saveSession(newId, persistData);

      // Update cookie
      setSessionCookie(c, newId);

      return newId;
    },

    async destroy(): Promise<void> {
      destroyed = true;
      await deleteSession(sessionId);
      deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
    },
  });

  c.set('session', session);

  await next();

  // Persist session after handler (unless destroyed)
  if (!destroyed) {
    const { id: _id, save: _s, regenerate: _r, destroy: _d, ...persistData } = session;
    await saveSession(sessionId, persistData);
    setSessionCookie(c, sessionId);
  }
}

// ---------------------------------------------------------------------------
// Cookie helper
// ---------------------------------------------------------------------------

function setSessionCookie(c: Context<AppEnv>, id: string): void {
  setCookie(c, SESSION_COOKIE_NAME, id, {
    httpOnly: COOKIE_CONFIG.httpOnly,
    sameSite: COOKIE_CONFIG.sameSite === 'strict' ? 'Strict' : 'Lax',
    secure: COOKIE_CONFIG.secure,
    maxAge: Math.floor(COOKIE_CONFIG.maxAge / 1000), // Hono expects seconds
    path: COOKIE_CONFIG.path,
  });
}
