/**
 * Authentication Controller
 *
 * Registration flow:
 * 1. User provides their email address via /self-register
 * 2. System generates a verification token and sends a link to that email
 *    - In development: Link is logged to console and returned in response
 *    - In production: Link is sent via email (implementation required)
 * 3. User clicks the verification link, which calls /verify-email/:token
 * 4. If token is valid, user's email is stored in session as "verified"
 * 5. User completes registration with their display name via /complete-registration
 * 6. User account is created and user is logged in
 * 7. User registers a passkey for future authentication
 *
 * This flow ensures that users verify email ownership before account creation
 * and prevents users from registering with email addresses they don't control.
 */

import type { Context } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { env } from '../config/env.ts';
import { userRegisterSchema } from '../validators/userValidator.ts';
import userService from '../services/user.ts';
import webauthnService from '../services/webauthn.ts';
import tenantService from '../services/tenant.ts';
import tenantRepository from '../repositories/tenant.ts';
import authenticatorRepository from '../repositories/authenticator.ts';
import emailVerificationService from '../services/emailVerification.ts';
import { db } from '../db/client.ts';
import { sql } from 'drizzle-orm';
import { users } from '../db/schema/index.ts';

/**
 * Verify email token and setup user for registration
 */
export async function verifyEmailToken(c: Context<AppEnv>): Promise<Response> {
  const token = c.req.param('token');

  if (!token) {
    return c.json({ success: false, message: 'Token is required' }, 400);
  }

  console.log(`Verifying email token: ${token.substring(0, 8)}...`);

  // Verify the token
  const verification = await emailVerificationService.verifyEmailToken(token);

  if (!verification) {
    return c.json({
      success: false,
      message: 'Invalid or expired verification token',
    }, 400);
  }

  // Store verified email in session for registration
  const session = c.get('session');
  session.verifiedEmail = verification.email;
  session.isFirstUser = verification.isFirstUser ?? false;

  // If this is an invitation, store invitation details
  if (verification.invitingTenantId) {
    session.invitingTenantId = verification.invitingTenantId;
    session.invitedRole = verification.invitedRole ?? undefined;
  }

  session.verificationToken = token;
  await session.save();

  console.log('Session saved successfully with verified email:', session.verifiedEmail);

  const message = verification.invitingTenantId
    ? `You've been invited to join an organization. Please complete registration.`
    : 'Email verified successfully';

  return c.json({
    success: true,
    message,
    email: verification.email,
    isFirstUser: verification.isFirstUser,
    isInvitation: !!verification.invitingTenantId,
    invitingTenant: verification.invitingTenantId
      ? { id: verification.invitingTenantId }
      : undefined,
  });
}

/**
 * Complete registration with verified email
 */
export async function completeRegistration(c: Context<AppEnv>): Promise<Response> {
  const session = c.get('session');

  // Check if email was verified
  if (!session.verifiedEmail) {
    return c.json({
      success: false,
      message: 'Email verification required before registration',
    }, 400);
  }

  const email = session.verifiedEmail;
  const body = (c.get('sanitizedBody') || await c.req.json()) as { displayName?: string };
  const displayName = body.displayName || email.split('@')[0];

  console.log(`Completing registration for verified email: ${email}`);

  // Check if user already exists
  const existingUser = await userService.getUserByEmail(email);
  if (existingUser) {
    return c.json({
      success: false,
      message: 'User with this email already exists',
    }, 400);
  }

  // Atomic first-user determination and user creation (CWE-362 fix)
  // Use advisory lock to serialize concurrent first-user checks
  const user = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1)`);
    const allUsers = await tx.select().from(users);
    const role = allUsers.length === 0 ? 'admin' : 'user';
    return userService.createUser({ email, displayName, role });
  });

  // Create personal tenant
  await tenantService.createPersonalTenantIfNeeded(user.id, user.email);

  // Handle invitation if present
  const invitingTenantId = session.invitingTenantId;
  const invitedRole = session.invitedRole;

  if (invitingTenantId && invitedRole) {
    console.log(`Handling invitation for user ${user.id} to tenant ${invitingTenantId} with role ${invitedRole}`);

    try {
      await tenantRepository.addTenantMember({
        tenantId: invitingTenantId,
        userId: user.id,
        role: invitedRole as 'owner' | 'admin' | 'member',
        status: 'active',
      });
      console.log(`Added user ${user.id} to tenant ${invitingTenantId} with role ${invitedRole}`);
    } catch (error) {
      console.error(`Error adding user to invited tenant: ${error}`);
      // Continue with registration even if tenant membership fails
    }
  }

  // Regenerate session to prevent session fixation
  await session.regenerate();

  // Set user session for WebAuthn registration
  session.userId = user.id;
  session.username = user.email;
  session.role = user.role;
  await session.save();

  return c.json({
    success: true,
    message: 'Registration completed successfully',
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
  }, 201);
}

/**
 * Register a new user (admin only - for creating additional users)
 */
export async function registerUser(c: Context<AppEnv>): Promise<Response> {
  const body = c.get('sanitizedBody') || await c.req.json();
  const data = userRegisterSchema.parse(body);

  const user = await userService.createUser({
    email: data.email,
    displayName: data.displayName,
  });

  return c.json({
    success: true,
    message: 'User created successfully',
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
  }, 201);
}

/**
 * Initiate user registration (public endpoint)
 * Only collects email and sends verification link
 */
export async function selfRegister(c: Context<AppEnv>): Promise<Response> {
  console.log('Self-register request received');

  const body = (c.get('sanitizedBody') || await c.req.json()) as { email: string };

  // Basic email validation
  const emailRegex = env.isProd
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    : /^.+@.+\..+$/;

  if (!body.email || !emailRegex.test(body.email)) {
    return c.json({
      success: false,
      message: 'Valid email address is required',
    }, 400);
  }

  const email = body.email;

  // Check if user already exists
  const existingUser = await userService.getUserByEmail(email);
  if (existingUser) {
    // Don't reveal if user exists for security reasons
    return c.json({
      success: true,
      message: 'If your email is valid, a verification link will be sent to it',
    });
  }

  // Check if this is the first user
  const allUsers = await userService.getAllUsers();
  const isFirstUser = allUsers.length === 0;

  // Create a verification token
  const token = await emailVerificationService.createEmailVerification(email, isFirstUser);

  // Build the verification link
  const baseUrl = env.ORIGIN || 'http://localhost:3000';
  const verificationLink = `${baseUrl}/verify-email/${token}`;

  if (env.isProd) {
    // TODO: Implement email sending in production
    console.log(`[PRODUCTION] Would send verification email to ${email} with link: ${verificationLink}`);

    return c.json({
      success: true,
      message: 'Verification link has been sent to your email',
    });
  }

  // In development, log the link and return it in the response for easy testing
  console.log(`\n===== DEVELOPMENT MODE =====`);
  console.log(`Verification link for ${email}:`);
  console.log(`${verificationLink}`);
  console.log(`=============================\n`);

  return c.json({
    success: true,
    message: 'Verification link has been sent to your email (see console log for details)',
    dev: {
      note: 'These fields are only included in development mode',
      verificationLink,
      token,
      isFirstUser,
      directApiVerify: `/api/auth/verify-email/${token}`,
    },
  });
}

/**
 * Get registration options for WebAuthn
 */
export async function getRegistrationOptions(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  // Get user from database
  const dbUser = await userService.getUserById(user.id);
  if (!dbUser) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  // Get existing authenticators for exclusion
  const existingAuths = await authenticatorRepository.getAuthenticatorsByUserId(user.id);

  // Generate registration options
  const options = await webauthnService.generateRegistrationOpts(
    { id: dbUser.id, email: dbUser.email, displayName: dbUser.displayName ?? undefined },
    existingAuths.map((a) => ({
      credentialId: a.credentialId,
      transports: a.transports ?? undefined,
    })),
  );

  // Store challenge in session for later verification
  const session = c.get('session');
  session.challenge = options.challenge;
  await session.save();

  return c.json(options);
}

/**
 * Verify registration response for WebAuthn
 */
export async function verifyRegistration(c: Context<AppEnv>): Promise<Response> {
  console.log('WebAuthn registration verification request received');

  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  // Get challenge from session
  const session = c.get('session');
  const challenge = session.challenge;
  if (!challenge) {
    return c.json({
      success: false,
      message: 'Registration challenge not found in session',
    }, 400);
  }

  // Clear challenge from session
  delete session.challenge;

  const body = (c.get('sanitizedBody') || await c.req.json()) as unknown as import('@simplewebauthn/server').RegistrationResponseJSON;

  // Verify registration
  const verification = await webauthnService.verifyRegistration(body, challenge);

  if (verification.verified && verification.registrationInfo) {
    // Store the authenticator
    const credential = verification.registrationInfo.credential;
    const authData = webauthnService.formatAuthenticatorForStorage({
      id: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports,
    });

    await authenticatorRepository.createAuthenticator({
      userId: user.id,
      credentialId: authData.credentialId,
      publicKey: authData.publicKey,
      counter: authData.counter,
      deviceType: authData.deviceType,
      transports: authData.transports,
    });

    return c.json({
      success: true,
      message: 'Registration successful',
    });
  }

  return c.json({
    success: false,
    message: 'Registration verification failed',
  }, 400);
}

/**
 * Get authentication options for WebAuthn
 */
export async function getAuthenticationOptions(c: Context<AppEnv>): Promise<Response> {
  const body = (c.get('sanitizedBody') || await c.req.json()) as { email?: string };
  const email = body.email;

  // Get user's authenticators if email provided
  let authenticators: Array<{ credentialId: string; transports?: string }> = [];
  if (email) {
    const user = await userService.getUserByEmail(email);
    if (user) {
      const auths = await authenticatorRepository.getAuthenticatorsByUserId(user.id);
      authenticators = auths.map((a) => ({
        credentialId: a.credentialId,
        transports: a.transports ?? undefined,
      }));
    }
  }

  // Generate authentication options
  const options = await webauthnService.generateAuthenticationOpts(authenticators);

  // Store challenge in session for later verification
  const session = c.get('session');
  session.challenge = options.challenge;
  await session.save();

  return c.json(options);
}

/**
 * Verify authentication response for WebAuthn
 */
export async function verifyAuthentication(c: Context<AppEnv>): Promise<Response> {
  console.log('Verifying authentication...');

  const session = c.get('session');

  // Get challenge from session
  const challenge = session.challenge;
  if (!challenge) {
    return c.json({
      success: false,
      message: 'Authentication challenge not found in session',
    }, 400);
  }

  // Clear challenge from session
  delete session.challenge;

  const body = (c.get('sanitizedBody') || await c.req.json()) as unknown as import('@simplewebauthn/server').AuthenticationResponseJSON;

  // Find the authenticator by credential ID from the response
  const credentialId = body.id;
  const authenticator = await authenticatorRepository.getAuthenticatorByCredentialId(credentialId);

  if (!authenticator || !authenticator.user) {
    return c.json({
      success: false,
      message: 'Authenticator not found',
    }, 401);
  }

  // Verify authentication
  const verification = await webauthnService.verifyAuthentication(
    body,
    challenge,
    {
      credentialId: authenticator.credentialId,
      publicKey: authenticator.publicKey,
      counter: authenticator.counter ?? '0',
      transports: authenticator.transports ?? undefined,
    },
  );

  if (verification.verified) {
    const user = authenticator.user;
    console.log(`User authenticated: ${user.email}`);

    // Update authenticator counter
    await authenticatorRepository.updateAuthenticatorCounter(
      authenticator.id,
      String(verification.authenticationInfo.newCounter),
    );

    // Activate any pending tenant memberships
    try {
      await tenantRepository.activatePendingMemberships(user.id);
      console.log(`Activated pending memberships for user ${user.id}`);
    } catch (error) {
      console.error('Error activating pending memberships:', error);
    }

    // Regenerate session to prevent session fixation
    await session.regenerate();

    // Set user session data on the new session
    session.userId = user.id;
    session.username = user.email;
    session.role = user.role;
    await session.save();

    console.log('Session saved successfully');
    return c.json({
      success: true,
      message: 'Authentication successful',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  }

  console.log('Authentication verification failed');
  return c.json({
    success: false,
    message: 'Authentication failed',
  }, 401);
}

/**
 * Get current user info
 */
export async function getCurrentUser(c: Context<AppEnv>): Promise<Response> {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, message: 'Authentication required' }, 401);
  }

  const dbUser = await userService.getUserById(user.id);
  if (!dbUser) {
    return c.json({ success: false, message: 'User not found' }, 404);
  }

  const authenticators = await authenticatorRepository.getAuthenticatorsByUserId(user.id);

  return c.json({
    success: true,
    user: {
      id: dbUser.id,
      email: dbUser.email,
      displayName: dbUser.displayName,
      role: dbUser.role,
      authenticatorCount: authenticators.length,
    },
  });
}

/**
 * Logout current user
 */
export async function logout(c: Context<AppEnv>): Promise<Response> {
  const session = c.get('session');
  await session.destroy();

  return c.json({ success: true, message: 'Logout successful' });
}
