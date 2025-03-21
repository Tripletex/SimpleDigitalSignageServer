# SimpleDigitalSignageServer

This is a Simple Digital Signage Server project for managing device registrations. It uses AWS DynamoDB for data storage.

## Development Setup

### Prerequisites

- Node.js
- Docker and Docker Compose
- TypeScript

### Running DynamoDB Locally

The project includes a Docker Compose configuration for running DynamoDB locally:

```bash
# Start local DynamoDB instance
docker-compose up -d
```

To verify the DynamoDB container is running:
```bash
docker ps
```

You should see the `dynamodb-local` container running on port 8000.

### Local Development Setup

For development with the local DynamoDB instance, use the provided dev script:

```bash
# From the server directory
./dev.sh
```

This script:
1. Unsets any existing AWS credentials
2. Sets the proper environment variables for local DynamoDB
3. Starts the server in development mode

If you encounter issues with table creation, you can manually create the table:

```bash
# From the server directory
./scripts/create-local-table.sh
```

### Environment Variables

For local development, these variables are set automatically by the dev script:

```bash
# DynamoDB Configuration (for local development)
export DYNAMODB_ENDPOINT=http://localhost:8000
export AWS_REGION=us-east-1
```

For production with real AWS DynamoDB, do not set the DYNAMODB_ENDPOINT variable, and ensure your environment has the proper AWS credentials configured.

### Starting the Server

Install dependencies and start the server:

```bash
# Install dependencies
cd server
npm install

# Start the development server
npm start
```

The server will automatically create the required DynamoDB tables on startup.

## API Endpoints

- `POST /api/device/register` - Register a new device
- `GET /api/device/list` - List all registered devices
- `GET /api/device/:id` - Get a specific device by ID

## Source Code

This project is open source and available on GitHub:
[SimpleDigitalSignageServer](https://github.com/yourusername/SimpleDigitalSignageServer)