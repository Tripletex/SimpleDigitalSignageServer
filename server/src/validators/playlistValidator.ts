import Joi from 'joi';

// Validator for playlist item
export const playlistItemSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  type: Joi.string().valid('URL', 'SLEEP', 'IMAGE', 'YOUTUBE').required(),
  url: Joi.when('type', {
    is: Joi.alternatives().try('URL', 'IMAGE', 'YOUTUBE'),
    then: Joi.object({
      location: Joi.string().uri({
        scheme: [
          'http',
          'https'
        ]
      }).required().messages({
        'string.uri': 'URL must be a valid web address starting with http:// or https://',
        'string.empty': 'URL cannot be empty',
        'any.required': 'URL is required for this content type'
      })
    }).required(),
    otherwise: Joi.optional()
  }),
  duration: Joi.number().integer().min(1).required().messages({
    'number.base': 'Duration must be a number',
    'number.integer': 'Duration must be a whole number',
    'number.min': 'Duration must be at least 1 second',
    'any.required': 'Duration is required'
  }),
  position: Joi.number().integer().min(0).optional()
});

// Validator for playlist
export const playlistSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).allow('', null).optional(),
  items: Joi.array().items(playlistItemSchema).optional()
});

// Validator for reordering playlist items
export const playlistReorderSchema = Joi.object({
  itemIds: Joi.array().items(Joi.string().uuid()).min(1).required()
});