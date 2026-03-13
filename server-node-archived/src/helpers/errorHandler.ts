// utils/errorHandler.ts
import { Request, Response } from 'express';
import Joi from "joi";

export function handleErrors(controllerFunction: (req: Request, res: Response) => Promise<void>) {
    return async (req: Request, res: Response) => {
        try {
            await controllerFunction(req, res);
        } catch (error) {
            const isDev = process.env.NODE_ENV === 'development';

            if (error instanceof Joi.ValidationError) {
                // Joi validation errors are user-facing — safe to return in all environments
                res.status(400).json({ message: error.message });
            } else if (error instanceof Error) {
                console.error('Unhandled error:', error.message, error.stack);
                res.status(500).json({
                    message: isDev ? error.message : 'Internal server error'
                });
            } else {
                console.error('Unknown error:', error);
                res.status(500).json({
                    message: isDev ? 'An unknown error occurred' : 'Internal server error',
                    ...(isDev && { error: error })
                });
            }
        }
    };
}