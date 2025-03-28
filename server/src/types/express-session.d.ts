// Add custom properties to express-session
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    username?: string; // We keep this as username but store email in it for backward compatibility
    role?: string;
    challenge?: string;
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
  }
}