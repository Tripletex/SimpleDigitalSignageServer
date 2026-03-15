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
 * 5. User provides display name via /complete-registration
 *    - A UUIDv7 is pre-generated and stored in session (no DB record yet)
 *    - WebAuthn registration options are returned directly
 * 6. User creates a passkey in the browser
 * 7. Passkey is verified via /webauthn/register-new
 *    - Only NOW is the user account created in the database
 *    - Authenticator, tenant setup, and invitations are processed
 *    - User is logged in
 *
 * This passkey-first flow ensures that users can never end up with an account
 * but no passkey (which would lock them out permanently).
 */

import type { Context } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { env } from '../config/env.ts';
import { userRegisterSchema } from '../validators/userValidator.ts';
import userService from '../services/user.ts';
import webauthnService from '../services/webauthn.ts';
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

  // Token stays in the DB until registration is fully complete
  // (deleted in verifyNewRegistration after passkey setup succeeds)

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
 *
 * This does NOT create the user account. Instead, it:
 * 1. Pre-generates a UUIDv7 for the future user
 * 2. Determines the role (admin if first user)
 * 3. Stores pending registration data in the session
 * 4. Returns WebAuthn registration options directly
 *
 * The user account is only created after passkey verification succeeds
 * (in verifyNewRegistration), preventing orphaned accounts.
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

  // Determine role atomically (admin if first user)
  const role = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(1)`);
    const allUsers = await tx.select().from(users);
    return allUsers.length === 0 ? 'admin' : 'user';
  });

  // Pre-generate a UUIDv7 for the future user
  const { uuidv7 } = await import('../utils/helpers.ts');
  const pendingUserId = uuidv7();

  // Store pending registration in session (no user created yet)
  session.pendingUserId = pendingUserId;
  session.pendingDisplayName = displayName;
  session.pendingRole = role;

  // Generate WebAuthn registration options using the pending user ID
  const options = await webauthnService.generateRegistrationOpts(
    { id: pendingUserId, email, displayName },
    [], // No existing authenticators for a new user
  );

  // Store challenge in session for verification
  session.challenge = options.challenge;
  await session.save();

  console.log(`Pending registration stored for ${email} with ID ${pendingUserId} (role: ${role})`);

  return c.json({
    success: true,
    message: 'Please create a passkey to complete registration',
    registrationOptions: options,
  });
}

/**
 * Verify passkey and create user account (passkey-first registration)
 *
 * This is called after completeRegistration. It:
 * 1. Verifies the WebAuthn registration response
 * 2. Creates the user account with the pre-generated ID
 * 3. Stores the authenticator credential
 * 4. Sets up tenant memberships and invitations
 * 5. Logs the user in
 */
export async function verifyNewRegistration(c: Context<AppEnv>): Promise<Response> {
  const session = c.get('session');

  // Verify we have pending registration data
  const pendingUserId = session.pendingUserId;
  const email = session.verifiedEmail;
  const displayName = session.pendingDisplayName;
  const role = session.pendingRole;
  const challenge = session.challenge;

  if (!pendingUserId || !email || !challenge) {
    return c.json({
      success: false,
      message: 'No pending registration found. Please start the registration process again.',
    }, 400);
  }

  // Clear challenge immediately to prevent replay
  delete session.challenge;

  const body = (c.get('sanitizedBody') || await c.req.json()) as unknown as import('@simplewebauthn/server').RegistrationResponseJSON;

  // Verify the passkey registration
  const verification = await webauthnService.verifyRegistration(body, challenge);

  if (!verification.verified || !verification.registrationInfo) {
    return c.json({
      success: false,
      message: 'Passkey verification failed. Please try again.',
    }, 400);
  }

  // Passkey verified! Now create the user account with the pre-generated ID
  console.log(`Passkey verified, creating user account for ${email} (ID: ${pendingUserId})`);

  const user = await userService.createUser({
    id: pendingUserId,
    email,
    displayName,
    role: role as 'admin' | 'user',
  });

  // Store the authenticator credential
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

  // Create personal tenant and process pending invitations
  await userService.processNewUserTenantSetup(user.id, user.email);

  // Handle session-based invitation (invite link)
  const invitingTenantId = session.invitingTenantId;
  const invitedRole = session.invitedRole;

  if (invitingTenantId && invitedRole) {
    const existingMember = await tenantRepository.getTenantMember(invitingTenantId, user.id);
    if (!existingMember) {
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
      }
    }
  }

  // Consume the verification token now that registration is fully complete
  if (session.verificationToken) {
    const tokenRecord = await emailVerificationService.verifyEmailToken(session.verificationToken);
    if (tokenRecord) {
      await emailVerificationService.deleteVerification(tokenRecord.id);
    }
  }

  // Clear pending registration data
  delete session.pendingUserId;
  delete session.pendingDisplayName;
  delete session.pendingRole;
  delete session.verifiedEmail;
  delete session.isFirstUser;
  delete session.invitingTenantId;
  delete session.invitedRole;
  delete session.verificationToken;

  // Regenerate session to prevent session fixation
  await session.regenerate();

  // Log the user in
  session.userId = user.id;
  session.username = user.email;
  session.role = user.role;
  await session.save();

  console.log(`User ${user.email} registered and logged in successfully`);

  return c.json({
    success: true,
    message: 'Registration successful',
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
  const parsed = userRegisterSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({
      success: false,
      message: 'Valid email address is required',
    }, 400);
  }

  const email = parsed.data.email;

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

  // Build the verification link using the configured origin (not request headers, which are attacker-controlled)
  const verificationLink = `${env.ORIGIN}/verify-email/${token}`;

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
