# SimpleDigitalSignageServer

This is a Simple Digital Signage Server project for managing device registrations. It uses PostgreSQL for data storage.

## Development Setup

### Prerequisites

- Node.js
- Docker and Docker Compose
- TypeScript

### Running PostgreSQL Locally

The project includes a Docker Compose configuration for running Postgresql locally:

```bash
# Start local PostgreSQL instance
docker-compose up -d
```

To verify the Postygresql container is running:
```bash
docker ps
```

### Local Development Setup

For development with the local PostgreSQL instance, use the provided dev script:

```bash
# From the server directory
./dev.sh
```

### Environment Variables


### Starting the Server

Install dependencies and start the server:

```bash
# Install dependencies
cd server
npm install

# Start the development server
npm start
```

The server will automatically create the required PostgreSQL tables on startup.

## API Endpoints

- `POST /api/device/register` - Register a new device
- `GET /api/device/list` - List all registered devices
- `GET /api/device/:id` - Get a specific device by ID

## Source Code

This project is open source and available on GitHub:
[SimpleDigitalSignageServer](https://github.com/yourusername/SimpleDigitalSignageServer)