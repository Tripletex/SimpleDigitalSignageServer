# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run Commands
- Server: `cd server && deno task dev` (dev mode with watch), `deno task start` (production)
- Admin UI dev: `cd server && deno task dev:admin` (Vite dev server on port 3000)
- Admin UI build: `cd server && deno task build:admin` (outputs to server/dist/)
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

## Admin UI Stack
- **Framework**: React 18 with TypeScript
- **Build**: Vite (deps in server/package.json)
- **Routing**: react-router-dom v6
- **Source**: `server/admin/` — built to `server/dist/`, served by the Deno server
- **Dev proxy**: Vite proxies /api to localhost:4000

## Project Structure
```
├── server/
│   ├── deno.json        # Server config (Deno imports, tasks)
│   ├── package.json     # Admin UI dependencies (React, Vite)
│   ├── vite.config.ts   # Admin UI build config
│   ├── index.html       # Vite entry point
│   ├── src/             # Hono API server
│   ├── admin/           # React admin UI source
│   ├── migrations/      # Database migrations
│   └── dist/            # Built admin UI output
└── shared/              # Shared TypeScript types
```

## Database Migrations
- Project uses node-pg-migrate for explicit, versioned migrations
- Migration files are in `server/migrations/` directory
- Each migration includes up (apply) and down (revert) functions

## Code Style Guidelines
- **Formatting**: 2-space indentation, single quotes, semicolons, trailing commas
- **Naming**: camelCase for variables/functions, PascalCase for classes/components
- **Imports**: 3rd-party first, project imports second, grouped by category; use `.ts` extensions for server code
- **Types**: Use TypeScript interfaces/types, explicit return types on functions
- **Error Handling**: try/catch blocks, error middleware (handleErrors wrapper), consistent response structure
- **Architecture**: Follow separation of concerns (controllers, services, repositories)
- **Components**: Use functional React components with hooks
- **State Management**: React hooks for local state

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
- **Tenant Authorization**: Comprehensive multi-tenant authorization system
  - Role-based access control (Owner/Admin/Member roles)
  - Cached membership validation for performance (5-min TTL)
