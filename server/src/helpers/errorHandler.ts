// utils/errorHandler.ts
import { Request, Response } from 'express';
import Joi from "joi";

export function handleErrors(controllerFunction: (req: Request, res: Response) => Promise<void>) {
    return async (req: Request, res: Response) => {
        try {
            await controllerFunction(req, res);
        } catch (error) {
            if(error instanceof Joi.ValidationError) {
                res.status(400).json({message: error.message});
            } else if(error instanceof Error) {
                res.status(500).json({message: error.message});
            } else {
                res.status(500).json({message: 'An unknown error occurred', error: error});
            }
        }
    };
}