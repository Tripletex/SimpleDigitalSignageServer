# Simple Digital Signage Server

A server for a simple digital signage system that uses PostgreSQL for data storage.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in a `.env` file:
```
PORT=4000                      # Server port
CLIENT_PATH=../../client/build # Path to client build
DB_HOST=localhost              # PostgreSQL host
DB_PORT=5432                   # PostgreSQL port
DB_USER=signage                # PostgreSQL user
DB_PASSWORD=signage            # PostgreSQL password
DB_NAME=signage                # PostgreSQL database name
SESSION_SECRET=your-secret-key # Session secret key
```

3. Build the project:
```bash
npm run build
```

4. Start the server:
```bash
npm start
```

## Development

1. Start the development server with auto-restart:
```bash
npm run dev
```

2. Lint the code:
```bash
npm run lint
```

3. Run TypeScript type-checking:
```bash
npm run typecheck
```

## Database

The server uses PostgreSQL for data storage. The database schema is automatically created when the server starts through Sequelize ORM. 

### Database Schema

- Users: Store user accounts with WebAuthn credentials
- Authenticators: WebAuthn authenticator devices for users
- Tenants: Organizations or personal workspaces
- TenantMembers: User membership in tenants
- Devices: Digital signage devices
- DeviceNetworks: Network information for devices
- DeviceRegistrations: Registration details for devices

### Docker Setup

You can run PostgreSQL in Docker using the provided docker-compose.yml file:

```bash
docker-compose up -d
```

## Authentication

The server uses WebAuthn for passwordless authentication. See auth-docs.md for more details.

### Important Note

No example or default users are automatically created in the database. You will need to manually create the first user through the registration API endpoint:

```
POST /api/auth/register
{
  "email": "admin@example.com",
  "displayName": "Administrator"
}
```

This is a security best practice to avoid having default credentials in the system.