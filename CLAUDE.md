# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run Commands
- Server: `cd server && deno task dev` (dev mode with watch), `deno task start` (production)
- Client: `npm start` (dev server), `npm run build` (production)
- Tests: `cd server && deno task test`
- Type check: `cd server && deno task check`
- Database:
  - Migrations: `cd server && deno task db:migrate`, `deno task db:migrate:down`
  - Migration files are in `server/migrations/` (uses node-pg-migrate)

## Server Stack
- **Runtime**: Deno
- **Framework**: Hono (Express-like API)
- **ORM**: Drizzle ORM with postgres.js driver
- **Validation**: Zod
- **Auth**: WebAuthn via @simplewebauthn/server
- **Session**: Custom PostgreSQL-backed session middleware
- **IDs**: UUIDv7 (time-ordered) for all database record IDs

## Database Migrations
- Project uses node-pg-migrate for explicit, versioned migrations
- Migration files are in server/migrations/ directory
- Each migration includes up (apply) and down (revert) functions
- See server-node-archived/MIGRATIONS.md for historical documentation

## Code Style Guidelines
- **Formatting**: 2-space indentation, single quotes, semicolons, trailing commas
- **Naming**: camelCase for variables/functions, PascalCase for classes/components
- **Imports**: 3rd-party first, project imports second, grouped by category; use `.ts` extensions
- **Types**: Use TypeScript interfaces/types, explicit return types on functions
- **Error Handling**: try/catch blocks, error middleware (handleErrors wrapper), consistent response structure
- **Architecture**: Follow separation of concerns (controllers, services, repositories)
- **Components**: Use functional React components with hooks
- **State Management**: React hooks for local state
- **Documentation**: JSDoc comments for functions and complex logic

## Security Requirements
- All user input must be validated and sanitized both on the client side and server side
- Follow secure authentication practices with WebAuthn
- Implement proper authorization checks for API endpoints
- Never log sensitive information (credentials, tokens, PII)
- Use parameterized queries to prevent SQL injection
- Apply multi-tenant data isolation throughout the application
- **Session Security**: Use cryptographically secure session secrets (minimum 32 characters)
  - Generate with: `deno eval "const a=new Uint8Array(32);crypto.getRandomValues(a);console.log(Array.from(a,b=>b.toString(16).padStart(2,'0')).join(''))"`
  - Never use default/example secrets in production
- **XSS Protection**: Comprehensive Cross-Site Scripting prevention implemented
  - Automatic input sanitization and output encoding
  - Content Security Policy (CSP) headers with per-request nonces
  - Field-specific sanitization rules for different content types
- **Tenant Authorization**: Comprehensive multi-tenant authorization system
  - Role-based access control (Owner/Admin/Member roles)
  - Cached membership validation for performance (5-min TTL)
  - Authorization bypass prevention for all tenant-specific endpoints

## Project Structure
- Server: Deno/Hono backend with TypeScript, PostgreSQL database (Drizzle ORM)
- Client: React frontend with TypeScript and CSS modules
- Shared: Common types and interfaces used by both client and server
- server-node-archived: Previous Node.js/Express server (kept as reference)
