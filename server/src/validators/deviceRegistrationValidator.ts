// validators/deviceRegistrationValidator.ts
import Joi from 'joi';

export const deviceRegistrationRequestSchema = Joi.object({
    deviceType: Joi.string().optional(),
    hardwareId: Joi.string().optional(),
    publicKey: Joi.string().required() // Require public key, but don't enforce specific length or format
})

export const deviceClaimSchema = Joi.object({
    deviceId: Joi.string().required(),
    displayName: Joi.string().optional()
});

export const deviceCampaignAssignmentSchema = Joi.object({
    deviceId: Joi.string().required(),
    campaignId: Joi.alternatives().try(
        Joi.string().required(),
        Joi.valid(null)
    ).required()
});