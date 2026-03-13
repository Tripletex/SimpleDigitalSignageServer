import { Schema, ValidationResult } from 'joi';
import { Request } from 'express';
import { sanitizeObject, FIELD_SANITIZATION_RULES } from '../middleware/xssProtectionMiddleware';

/**
 * Enhanced validation with XSS protection
 * Validates input schema and applies sanitization to prevent XSS attacks
 */
export async function validateAndConvert<T>(req: Request, schema: Schema): Promise<T> {
    // First apply XSS sanitization to the request body
    const sanitizedBody = sanitizeObject(req.body, FIELD_SANITIZATION_RULES);
    
    // Then validate the sanitized data against the schema
    const { error, value }: ValidationResult = schema.validate(sanitizedBody);
    if (error) {
        throw new Error(`Validation error: ${error.details.map(x => x.message).join(', ')}`);
    }
    
    // Log validation success for security monitoring (development only)
    if (process.env.NODE_ENV === 'development') {
        console.log('[VALIDATION] Input validated and sanitized for:', req.path);
    }
    
    return value as T;
}

/**
 * Validate and sanitize query parameters
 */
export function validateQueryParams(req: Request, allowedParams: string[] = []): Record<string, any> {
    const sanitizedQuery: Record<string, any> = {};
    
    // Only allow specific query parameters to prevent injection
    for (const param of allowedParams) {
        if (req.query[param] !== undefined) {
            const value = req.query[param];
            
            if (typeof value === 'string') {
                // Sanitize string query parameters
                sanitizedQuery[param] = sanitizeObject(value, { [param]: { maxLength: 200, allowHtml: false } });
            } else if (Array.isArray(value)) {
                // Handle array query parameters
                sanitizedQuery[param] = value.map(v => 
                    typeof v === 'string' ? 
                        sanitizeObject(v, { [param]: { maxLength: 200, allowHtml: false } }) : 
                        v
                );
            } else {
                sanitizedQuery[param] = value;
            }
        }
    }
    
    return sanitizedQuery;
}