import { Hono } from 'hono';
import type { AppEnv } from '../types/context.ts';
import { handleErrors } from '../helpers/errorHandler.ts';
import * as userController from '../controllers/user.ts';
import { isAuthenticated, isAdmin } from '../middleware/auth.ts';

const app = new Hono<AppEnv>();

app.get('/profile', isAuthenticated, handleErrors(userController.getProfile));
app.put('/update', isAuthenticated, handleErrors(userController.updateProfile));
app.get('/passkeys', isAuthenticated, handleErrors(userController.getPasskeys));
app.put('/passkeys/:id', isAuthenticated, handleErrors(userController.updatePasskeyName));
app.delete('/passkeys/:id', isAuthenticated, handleErrors(userController.deletePasskey));
app.get('/', isAuthenticated, isAdmin, handleErrors(userController.getAllUsers));
app.get('/:id', isAuthenticated, isAdmin, handleErrors(userController.getUserById));
app.put('/:id', isAuthenticated, isAdmin, handleErrors(userController.updateUser));
app.delete('/:id', isAuthenticated, isAdmin, handleErrors(userController.deleteUser));

export default app;
