// validators/deviceDataValidator.ts
import Joi from 'joi';

export const networkSchema = Joi.object({
    name: Joi.string().required(),
    ipAddress: Joi.array().items(Joi.string()).required(),
});

export const deviceDataSchema = Joi.object({
    id: Joi.string().guid({ version: 'uuidv4' }).required(),
    name: Joi.string().required(),
    networks: Joi.array().items(networkSchema).optional(),
    // The following fields are now optional since we're using JWT for authentication
    signature: Joi.string().optional(),
    timestamp: Joi.number().optional(),
});