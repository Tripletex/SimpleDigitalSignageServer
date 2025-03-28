// validators/userValidator.ts
import Joi from 'joi';

export const userRegisterSchema = Joi.object({
  email: Joi.string().email().required(),
  displayName: Joi.string().min(1).max(50).optional()
});