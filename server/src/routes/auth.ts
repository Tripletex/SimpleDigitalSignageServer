import { Hono } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { handleErrors } from '../helpers/errorHandler.ts';
import * as authController from '../controllers/auth.ts';
import { isAuthenticated, isAdmin } from '../middleware/auth.ts';
import { rateLimit } from '../middleware/rateLimit.ts';
import { csrfTokenHandler } from '../middleware/csrf.ts';

const app = new Hono<AppEnv>();

app.post('/register', isAuthenticated, isAdmin, handleErrors(authController.registerUser));
app.post('/self-register', rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }), handleErrors(authController.selfRegister));
app.get('/verify-email/:token', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), handleErrors(authController.verifyEmailToken));
app.post('/complete-registration', handleErrors(authController.completeRegistration));
app.get('/webauthn/registration-options', isAuthenticated, handleErrors(authController.getRegistrationOptions));
app.post('/webauthn/register', isAuthenticated, handleErrors(authController.verifyRegistration));
app.post('/webauthn/authentication-options', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), handleErrors(authController.getAuthenticationOptions));
app.post('/webauthn/authenticate', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), handleErrors(authController.verifyAuthentication));
app.get('/me', isAuthenticated, handleErrors(authController.getCurrentUser));
app.get('/csrf-token', csrfTokenHandler);
app.post('/logout', isAuthenticated, handleErrors(authController.logout));

export default app;
