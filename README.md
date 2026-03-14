# SimpleDigitalSignageServer

A Digital Signage Server for managing devices, playlists, and multi-tenant organizations. Includes an admin UI for management and serves a signage client on Raspberry Pi devices.

## Tech Stack

- **Runtime**: [Deno](https://deno.land/)
- **Server**: Hono + Drizzle ORM (PostgreSQL)
- **Admin UI**: React 18 + Vite + TypeScript
- **Auth**: WebAuthn (passkeys)
- **Validation**: Zod

## Development Setup

### Prerequisites

- [Deno](https://deno.land/) (latest)
- Docker and Docker Compose (for PostgreSQL)
- Node.js (for admin UI dependencies / Vite)

### Quick Start

```bash
# Start PostgreSQL
docker-compose up -d

# Install admin UI dependencies
cd server && npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your settings

# Run database migrations
deno task db:migrate

# Start the server (port 4000)
deno task dev

# In another terminal, start the admin UI dev server (port 3000)
deno task dev:admin
```

### Available Tasks (run from `server/`)

```bash
deno task dev          # Start server with auto-reload
deno task dev:admin    # Start Vite dev server for admin UI
deno task start        # Start server (production)
deno task build:admin  # Build admin UI for production
deno task test         # Run all tests
deno task check        # Type-check server code
deno task db:migrate   # Run database migrations
deno task db:migrate:down  # Revert last migration
```

### Environment Variables

Copy `server/.env.example` to `server/.env` and configure:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — PostgreSQL connection
- `SESSION_SECRET` — Cryptographically secure session secret (min 32 chars)
- `RP_ID`, `ORIGIN` — WebAuthn relying party config

### Project Structure

```
├── server/
│   ├── deno.json        # Server config (Deno imports, tasks)
│   ├── package.json     # Admin UI dependencies (React, Vite)
│   ├── vite.config.ts   # Admin UI build config
│   ├── index.html       # Vite entry point
│   ├── src/             # Hono API server
│   ├── admin/           # React admin UI source
│   ├── migrations/      # Database migrations (node-pg-migrate)
│   └── dist/            # Built admin UI output
├── shared/              # Shared TypeScript types
└── docker-compose.yml   # PostgreSQL dev setup
```

## API Endpoints

- `POST /api/device/register` - Register a new device
- `GET /api/device/list` - List all registered devices
- `GET /api/device/:id` - Get a specific device by ID

## Source Code

This project is open source and available on GitHub:
[SimpleDigitalSignageServer](https://github.com/Tripletex/SimpleDigitalSignageServer)
