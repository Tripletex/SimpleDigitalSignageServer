// validators/deviceRegistrationValidator.ts
import Joi from 'joi';

export const deviceRegistrationRequestSchema = Joi.object({
    deviceType: Joi.string().optional(),
    hardwareId: Joi.string().optional()
}).min(0); // Allow empty object for minimal registration