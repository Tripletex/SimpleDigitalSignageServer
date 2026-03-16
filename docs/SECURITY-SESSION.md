# Session Security Configuration

## Overview

This application uses express-session for session management. The session secret is critical for security as it's used to sign session cookies and prevent session hijacking attacks.

## Security Requirements

### Production Environment

In production (`NODE_ENV=production`), the application **requires** a strong session secret:

- **Minimum 32 characters** in length
- **Cryptographically secure** random string
- Must be set via `SESSION_SECRET` environment variable
- Cannot be the default/example values

### Development Environment

In development, the application will:
1. Use the `SESSION_SECRET` from environment if it's strong enough
2. **Auto-generate** a secure random secret if none is provided
3. Log a warning to remind you to set a proper secret for production

## Generating a Secure Session Secret

### Method 1: Node.js Command Line
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Method 2: OpenSSL
```bash
openssl rand -hex 32
```

### Method 3: Python
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

## Setting the Session Secret

### For Development
Add to your `.env` file:
```bash
SESSION_SECRET=your_generated_64_character_hex_string_here
```

### For Production
Set as environment variable (never commit to code):
```bash
export SESSION_SECRET=your_production_secret_here
```

Or in your deployment configuration:
- **Docker**: Use environment variables or secrets
- **Kubernetes**: Use secrets or external secret management
- **Cloud Providers**: Use their secret management services (AWS Secrets Manager, Azure Key Vault, etc.)

## Security Validation

The application automatically validates session secrets:

✅ **Valid Session Secret**
- At least 32 characters long
- Not a known default/example value
- Properly set in environment variables

❌ **Invalid Session Secret**
- Too short (< 32 characters)
- Uses default/example values
- Missing in production environment

## Error Messages

### Production Errors
```
SESSION_SECRET environment variable is required in production.
Generate a strong secret with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```
SESSION_SECRET must be at least 32 characters long and cannot be the default value.
Generate a strong secret with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Development Warnings
```
[SECURITY] Generated secure session secret for development: a1b2c3d4...
[SECURITY] For production, set SESSION_SECRET environment variable to a strong random value
```

## Best Practices

1. **Never reuse** session secrets across environments
2. **Rotate** session secrets periodically in production
3. **Store** production secrets in secure secret management systems
4. **Never commit** production secrets to version control
5. **Use** environment-specific configuration management
6. **Monitor** for session-related security events
7. **Implement** session timeout and cleanup policies

## Session Cookie Security

The application also implements secure cookie settings:

```typescript
{
  httpOnly: true,                    // Prevent XSS access to cookies
  sameSite: 'strict' (production),   // CSRF protection
  secure: true (production),         // HTTPS only in production
  maxAge: 24 * 60 * 60 * 1000       // 24 hour expiration
}
```

## Troubleshooting

### Server won't start in production
- Check that `SESSION_SECRET` environment variable is set
- Verify the secret is at least 32 characters long
- Ensure it's not a default/example value

### Session not persisting
- Verify session secret is consistent across server restarts
- Check cookie configuration for your deployment environment
- Ensure HTTPS is properly configured in production

## Related Security Measures

This session security works together with other security features:
- WebAuthn passwordless authentication
- CSRF protection via SameSite cookies  
- Row Level Security (RLS) for database isolation
- Multi-tenant authorization controls