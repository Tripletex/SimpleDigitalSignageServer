import Joi from 'joi';
import { TenantRole } from '../../../shared/src/tenantData';

export const tenantCreateSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  isPersonal: Joi.boolean().optional()
});

export const tenantUpdateSchema = Joi.object({
  name: Joi.string().required().min(1).max(100)
});

export const tenantInviteSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid(...Object.values(TenantRole)).required()
});

export const tenantMemberUpdateSchema = Joi.object({
  role: Joi.string().valid(...Object.values(TenantRole)).required()
});