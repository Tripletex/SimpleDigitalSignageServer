import Joi, { Schema, ValidationResult } from 'joi';
import { Request } from 'express';

export async function validateAndConvert<T>(req: Request, schema: Schema): Promise<T> {
    const { error, value }: ValidationResult = schema.validate(req.body);
    if (error) {
        throw new Error(`Validation error: ${error.details.map(x => x.message).join(', ')}`);
    }
    return value as T;
}