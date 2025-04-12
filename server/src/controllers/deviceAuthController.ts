import { Request, Response } from 'express';
import deviceAuthService from '../services/deviceAuthService';
import { handleErrors } from "../helpers/errorHandler";
import { validateAndConvert } from '../validators/validate';
import Joi from 'joi';
import {
  DeviceAuthenticationRequest,
  DeviceAuthenticationVerification
} from '../../../shared/src/deviceData';

// Validation schemas
const deviceAuthRequestSchema = Joi.object({
  deviceId: Joi.string().uuid().required()
});

const deviceAuthVerificationSchema = Joi.object({
  deviceId: Joi.string().uuid().required(),
  challenge: Joi.string().required(),
  signature: Joi.string().required()
});

class DeviceAuthController {
  /**
   * Step 1: Generate an authentication challenge for a device
   */
  public generateChallenge = handleErrors(async (req: Request, res: Response): Promise<void> => {
    const { deviceId } = await validateAndConvert<DeviceAuthenticationRequest>(
      req, 
      deviceAuthRequestSchema
    );
    
    const challenge = await deviceAuthService.generateAuthChallenge(deviceId);
    
    if (!challenge) {
      res.status(404).json({
        success: false,
        message: 'Device not found or not active'
      });
      return;
    }
    
    res.status(200).json(challenge);
  });
  
  /**
   * Step 2: Verify the challenge response and issue a token
   */
  public verifyChallenge = handleErrors(async (req: Request, res: Response): Promise<void> => {
    const { deviceId, challenge, signature } = await validateAndConvert<DeviceAuthenticationVerification>(
      req, 
      deviceAuthVerificationSchema
    );
    
    const result = await deviceAuthService.verifyAuthChallenge(
      deviceId,
      challenge,
      signature
    );
    
    if (!result.success) {
      res.status(401).json(result);
      return;
    }
    
    res.status(200).json(result);
  });
}

export default new DeviceAuthController();