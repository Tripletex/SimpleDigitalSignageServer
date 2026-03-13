# SimpleDigitalSignageServer

This is a Simple Digital Signage Server project for managing device registrations. It uses PostgreSQL for data storage.

## Development Setup

### Prerequisites

- [Deno](https://deno.land/) (latest)
- Docker and Docker Compose (for PostgreSQL)
- Node.js (for the React client)

### Running PostgreSQL Locally

The project includes a Docker Compose configuration for running PostgreSQL locally:

```bash
# Start local PostgreSQL instance
docker-compose up -d
```

### Starting the Server

```bash
cd server
deno task dev
```

The server starts on port 4000 with auto-reload on file changes.

### Starting the Client

```bash
cd client
npm install
npm start
```

### Running Tests

```bash
cd server
deno task test
```

### Environment Variables

Copy `server/.env.example` to `server/.env` and configure:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — PostgreSQL connection
- `SESSION_SECRET` — Cryptographically secure session secret (min 32 chars)
- `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` — WebAuthn relying party config

## API Endpoints

- `POST /api/device/register` - Register a new device
- `GET /api/device/list` - List all registered devices
- `GET /api/device/:id` - Get a specific device by ID

## Source Code

This project is open source and available on GitHub:
[SimpleDigitalSignageServer](https://github.com/yourusername/SimpleDigitalSignageServer)
