# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run Commands
- Server: `npm start` (dev mode), `npm run build` (compile TS)
- Client: `npm start` (dev server), `npm run build` (production)
- Database: 
  - Create/Drop: `npm run db:create`, `npm run db:drop`, `npm run db:reset`
  - Migrations: `npm run db:migrate`, `npm run db:migrate:down`, `npm run db:migrate:create name-of-migration`
  - Legacy: `npm run db:migrate:sequelize` (old Sequelize-based migration)
  - Seed data: `npm run db:seed`

## Database Migrations
- Project uses node-pg-migrate for explicit, versioned migrations
- Migration files are in server/migrations directory
- Each migration includes up (apply) and down (revert) functions
- Migrations run automatically during server startup
- See server/MIGRATIONS.md for complete documentation

## Code Style Guidelines
- **Formatting**: 2-space indentation, single quotes, semicolons, trailing commas
- **Naming**: camelCase for variables/functions, PascalCase for classes/components
- **Imports**: 3rd-party first, project imports second, grouped by category
- **Types**: Use TypeScript interfaces/types, explicit return types on functions
- **Error Handling**: try/catch blocks, error middleware, consistent response structure
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
  - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - Never use default/example secrets in production
  - See server/SECURITY-SESSION.md for detailed configuration
- **XSS Protection**: Comprehensive Cross-Site Scripting prevention implemented
  - Automatic input sanitization and output encoding
  - Content Security Policy (CSP) headers
  - Field-specific sanitization rules for different content types
  - See server/XSS-PROTECTION.md for complete documentation
- **Tenant Authorization**: Comprehensive multi-tenant authorization system
  - Role-based access control (Owner/Admin/Member roles)
  - Cached membership validation for performance
  - Authorization bypass prevention for all tenant-specific endpoints
  - See server/TENANT-AUTHORIZATION.md for complete documentation

## Project Structure
- Server: Express backend with TypeScript, PostgreSQL database
- Client: React frontend with TypeScript and CSS modules
- Shared: Common types and interfaces used by both client and server