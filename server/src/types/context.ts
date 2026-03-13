import type { Env } from 'hono';

export interface SessionData {
  userId?: string;
  username?: string;
  role?: string;
  challenge?: string;
  verifiedEmail?: string;
  isFirstUser?: boolean;
  invitingTenantId?: string;
  invitedRole?: string;
  verificationToken?: string;
  csrfToken?: string;
  user?: {
    id: string;
    email?: string;
    role?: string;
    displayName?: string;
  };
}

export interface Session extends SessionData {
  id: string;
  save(): Promise<void>;
  regenerate(): Promise<string>;
  destroy(): Promise<void>;
}

export type Variables = {
  session: Session;
  user: { id: string; email: string; role: string };
  device: { id: string; tenantId?: string };
  cspNonce: string;
  pgClient: unknown;
  secureQuery: <T>(callback: (client: unknown) => Promise<T>) => Promise<T>;
  tenant: unknown;
  tenantMembership: { role: string; status: string };
  sanitizedBody: Record<string, unknown>;
};

export type AppEnv = {
  Variables: Variables;
};
