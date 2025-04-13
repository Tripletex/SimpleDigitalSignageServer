import { Request, Response } from 'express';
import deviceAuthService from '../services/deviceAuthService';
import {
  DeviceAuthenticationRequest,
  DeviceAuthenticationVerification
} from '../../../shared/src/deviceData';

class DeviceAuthController {
  /**
   * Generate an authentication challenge for a device
   * @param req Request with deviceId
   * @param res Response with challenge
   */
  async generateChallenge(req: Request, res: Response) {
    try {
      const { deviceId } = req.body as DeviceAuthenticationRequest;
      
      if (!deviceId) {
        return res.status(400).json({
          success: false,
          message: 'Device ID is required'
        });
      }
      
      console.log(`[AUTH] Generating challenge for device: ${deviceId}`);
      
      const challenge = await deviceAuthService.generateAuthChallenge(deviceId);
      
      if (!challenge) {
        return res.status(404).json({
          success: false,
          message: 'Device not found or inactive'
        });
      }
      
      return res.status(200).json(challenge);
    } catch (error) {
      console.error('Error generating challenge:', error);
      return res.status(500).json({
        success: false,
        message: 'Error generating authentication challenge'
      });
    }
  }

  /**
   * Verify a challenge response and issue a JWT token
   * @param req Request with deviceId, challenge, and signature
   * @param res Response with JWT token
   */
  async verifyChallenge(req: Request, res: Response) {
    try {
      console.log('[AUTH] Received verify challenge request');
      console.log('[AUTH] Request body:', JSON.stringify(req.body));
      
      // Double-check that we have valid JSON
      if (!req.body || typeof req.body !== 'object') {
        console.error('[AUTH] Invalid request body - not a JSON object:', req.body);
        return res.status(400).json({
          success: false,
          message: 'Invalid request format: JSON object expected'
        });
      }
      
      const { deviceId, challenge, signature } = req.body as DeviceAuthenticationVerification;
      
      // Validate required parameters
      if (!deviceId) {
        console.error('[AUTH] Missing deviceId in request');
        return res.status(400).json({
          success: false,
          message: 'Device ID is required'
        });
      }
      
      if (!challenge) {
        console.error('[AUTH] Missing challenge in request');
        return res.status(400).json({
          success: false,
          message: 'Challenge is required'
        });
      }
      
      if (!signature) {
        console.error('[AUTH] Missing signature in request');
        return res.status(400).json({
          success: false,
          message: 'Signature is required'
        });
      }
      
      console.log(`[AUTH] Verifying challenge for device: ${deviceId}`);
      console.log(`[AUTH] Challenge: ${challenge.substring(0, 20)}...`);
      console.log(`[AUTH] Signature length: ${signature.length}`);
      
      // Try to verify the challenge
      try {
        const authResult = await deviceAuthService.verifyAuthChallenge(
          deviceId,
          challenge,
          signature
        );
        
        console.log(`[AUTH] Verification result: ${authResult.success ? 'SUCCESS' : 'FAILED'}`);
        console.log(`[AUTH] Message: ${authResult.message}`);
        
        // In case of success, log the token (first 20 chars only for security)
        if (authResult.success && authResult.token) {
          console.log(`[AUTH] Generated token (first 20 chars): ${authResult.token.substring(0, 20)}...`);
        }
        
        return res.status(authResult.success ? 200 : 401).json(authResult);
        
      } catch (verifyError) {
        console.error('[AUTH] Error in verifyAuthChallenge method:', verifyError);
        throw verifyError; // Re-throw to be caught by outer try-catch
      }
      
    } catch (error) {
      console.error('[AUTH] Uncaught error verifying challenge:', error);
      
      // Log error details
      if (error instanceof Error) {
        console.error('[AUTH] Error name:', error.name);
        console.error('[AUTH] Error message:', error.message);
        console.error('[AUTH] Error stack:', error.stack);
      } else {
        console.error('[AUTH] Unknown error type:', typeof error);
      }
      
      // Try to send a response (if not already sent)
      try {
        if (!res.headersSent) {
          return res.status(500).json({
            success: false,
            message: 'Error verifying authentication challenge',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        } else {
          console.error('[AUTH] Headers already sent, cannot send error response');
        }
      } catch (responseError) {
        console.error('[AUTH] Error sending error response:', responseError);
      }
    }
  }
}

export default new DeviceAuthController();