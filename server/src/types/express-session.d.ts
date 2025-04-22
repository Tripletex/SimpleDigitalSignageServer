// Add custom properties to express-session
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    username?: string; // We keep this as username but store email in it for backward compatibility
    role?: string;
    challenge?: string;
    verifiedEmail?: string; // For email verification flow
    isFirstUser?: boolean; // Flag for determining admin role
    invitingTenantId?: string; // For invitation flow
    invitedRole?: string; // For invitation flow
    verificationToken?: string; // Store token for later cleanup
    
    // Add user object for tenant security middleware
    user?: {
      id: string;
      email?: string;
      role?: string;
      displayName?: string;
    };
  }
}

// Add user property to express Request
declare module 'express' {
  interface Request {
    user?: {
      id: string;
      email: string;
      role: string;
    };
    // Add rawBody for crypto verification
    rawBody?: Buffer;
    // Add device property for device authentication
    device?: {
      id: string;
    };
  }
}