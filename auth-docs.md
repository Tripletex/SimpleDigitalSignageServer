# Authentication System Documentation

The Digital Signage Server uses WebAuthn (passkey) authentication to secure the administrative interface. This provides a passwordless, phishing-resistant authentication mechanism.

## Overview

The authentication system has the following features:

1. **Passwordless Authentication**: Users use biometrics (fingerprint, face ID) or security keys instead of passwords
2. **Role-Based Access Control**: Two roles - Admin and User
3. **Initial Admin Setup**: System automatically creates an initial admin account on first run
4. **Protection**: All APIs are protected except device registration and ping endpoints

## Endpoints

### Device Endpoints (Public)

- `POST /api/device/register` - Register a new device (public)
- `POST /api/device/ping` - Update device status (public)

### Authentication Endpoints

- `POST /api/auth/webauthn/authentication-options` - Get WebAuthn authentication options
- `POST /api/auth/webauthn/authenticate` - Authenticate using WebAuthn
- `GET /api/auth/webauthn/registration-options` - Get WebAuthn registration options (auth required)
- `POST /api/auth/webauthn/register` - Register a new authenticator (auth required)
- `GET /api/auth/me` - Get current user info (auth required)
- `POST /api/auth/logout` - Logout current user (auth required)

### User Management Endpoints (Admin Only)

- `POST /api/auth/register` - Register a new user (admin only)
- `GET /api/users` - Get all users (admin only)
- `GET /api/users/:id` - Get a user by ID (admin only)
- `PUT /api/users/:id` - Update a user (admin only)
- `DELETE /api/users/:id` - Delete a user (admin only)

## Initial Setup

On first run, the system creates an initial admin user with username `admin`. You'll need to add an authenticator for this user:

1. Login with the admin account (this requires using the WebAuthn registration API)
2. Use the registration endpoint to add a passkey

## Authentication Flow

### Registration Flow

1. User is created by an admin (`/api/auth/register`)
2. User logs in through WebAuthn and registers their authenticator
3. User can now authenticate using their passkey

### Authentication Flow

1. Application calls `/api/auth/webauthn/authentication-options`
2. User verifies with biometrics or security key
3. Application verifies authentication with `/api/auth/webauthn/authenticate`
4. If successful, a session is created

## Example Curl Commands

### Register a New User (Admin Only)

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=<your-session-cookie>" \
  -d '{
    "username": "newuser",
    "displayName": "New User",
    "email": "user@example.com"
  }'
```

### Get Current User

```bash
curl http://localhost:4000/api/auth/me \
  -H "Cookie: connect.sid=<your-session-cookie>"
```

### Logout

```bash
curl -X POST http://localhost:4000/api/auth/logout \
  -H "Cookie: connect.sid=<your-session-cookie>"
```

## WebAuthn / Passkey Integration

For client-side WebAuthn integration, you will need to:

1. Use the `@simplewebauthn/browser` library on your frontend
2. Call the appropriate endpoints to register and authenticate
3. Handle the WebAuthn ceremonies in the browser

## Environment Variables

- `RP_ID` - Relying Party ID for WebAuthn (defaults to 'localhost')
- `ORIGIN` - Origin URL for WebAuthn (defaults to 'http://localhost:4000')
- `SESSION_SECRET` - Secret for session encryption (please change in production!)
- `CORS_ORIGIN` - CORS origin domain (defaults to allow all origins in development)

## Security Notes

- **HTTPS Required**: In production, WebAuthn requires HTTPS
- **Session Security**: Session cookies are HTTP-only and secure in production
- **Initial Admin**: Change the initial admin's password in production environments