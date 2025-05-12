import { Request, Response } from 'express';
import deviceAuthService from '../services/deviceAuthService';
import {
  DeviceAuthenticationRequest,
  DeviceAuthenticationVerification
} from '../../../shared/src/deviceData';

class DeviceAuthController {
  /**
   * DEBUG ONLY: Direct verification endpoint that takes raw data and signature
   * @param req Request with raw data and signature
   * @param res Response with verification result
   */
  async debugVerify(req: Request, res: Response) {
    try {
      const { rawData, signature, publicKeyBase64 } = req.body;

      if (!rawData || !signature || !publicKeyBase64) {
        return res.status(400).json({
          success: false,
          message: 'Raw data, signature, and publicKeyBase64 are required'
        });
      }

      console.log(`[AUTH DEBUG] Received direct verification request`);
      console.log(`[AUTH DEBUG] Raw data: ${rawData}`);
      console.log(`[AUTH DEBUG] Signature length: ${signature.length}`);

      // Get public key from base64
      const publicKey = Buffer.from(publicKeyBase64, 'base64').toString('utf8');

      // Try verification directly
      const crypto = require('crypto');
      const verifier = crypto.createVerify('SHA256');
      verifier.update(rawData);

      // Convert signature from base64 to buffer
      const signatureBuffer = Buffer.from(signature, 'base64');

      try {
        const result = verifier.verify(publicKey, signatureBuffer);
        console.log(`[AUTH DEBUG] Direct verification result: ${result ? 'SUCCESS' : 'FAILURE'}`);

        return res.status(200).json({
          success: result,
          message: result ? 'Verification successful' : 'Verification failed'
        });
      } catch (verifyError) {
        console.error(`[AUTH DEBUG] Verification error:`, verifyError);
        return res.status(500).json({
          success: false,
          message: `Verification error: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`
        });
      }
    } catch (error) {
      console.error(`[AUTH DEBUG] Debug verification error:`, error);
      return res.status(500).json({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }

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
      // DEBUG: For testing, we'll try with different formats if the standard one fails
      try {
        // DEBUG: Save raw request data for comparison
        try {
          const fs = require('fs');
          const path = require('path');
          const debugDir = path.join('/tmp', 'signage-debug');
          if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
          }

          const timestamp = Date.now();
          fs.writeFileSync(
            path.join(debugDir, `server-req-${timestamp}.json`),
            JSON.stringify(req.body, null, 2)
          );

          // Save raw challenge and calculate its hash for comparison
          const rawChallenge = `{"deviceId":"${deviceId}","challenge":"${challenge}"}`;
          fs.writeFileSync(path.join(debugDir, `server-challenge-${timestamp}.txt`), rawChallenge);

          const crypto = require('crypto');
          const hash = crypto.createHash('sha256').update(rawChallenge).digest('hex');
          fs.writeFileSync(path.join(debugDir, `server-hash-${timestamp}.txt`), hash);

          console.log(`[AUTH] Raw challenge: ${rawChallenge}`);
          console.log(`[AUTH] Challenge hash: ${hash}`);
        } catch (debugErr) {
          console.error('[AUTH] Error saving debug data:', debugErr);
        }

        let authResult = await deviceAuthService.verifyAuthChallenge(
          deviceId,
          challenge,
          signature
        );

        // If verification failed, try alternative formats (for development/testing only)
        if (!authResult.success) {
          console.log(`[AUTH] Initial verification failed, trying with alternative formats...`);

          // Try with multi-line format
          const multilineData = `{
  "deviceId": "${deviceId}",
  "challenge": "${challenge}"
}`;
          console.log(`[AUTH] Trying with format 1 (multi-line format)`);
          const result = await deviceAuthService.verifySignatureWithData(
            deviceId,
            challenge,
            signature,
            multilineData
          );

          if (result.success) {
            console.log(`[AUTH] Alternative format verification succeeded!`);
            authResult = result;
          }
        }

        console.log(`[AUTH] Final verification result: ${authResult.success ? 'SUCCESS' : 'FAILED'}`);
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