import Joi from 'joi';

// Validator for playlist schedule
export const playlistScheduleSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  playlistId: Joi.string().uuid().required(),
  start: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(), // HH:MM format (24-hour)
  end: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(), // HH:MM format (24-hour)
  days: Joi.array().items(
    Joi.string().valid('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
  ).min(1).required()
});

// Validator for playlist group
export const playlistGroupSchema = Joi.object({
  id: Joi.string().uuid().optional(),
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).allow('', null).optional(),
  schedules: Joi.array().items(playlistScheduleSchema).optional()
});