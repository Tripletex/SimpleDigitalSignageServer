/**
 * Device authentication utilities
 * Handles cryptographic operations for device authentication
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Verify a signature created by a device
 * 
 * @param data - The data that was signed (string)
 * @param signature - The signature in base64 format
 * @param publicKey - The device's public key in base64 or PEM format
 * @returns true if the signature is valid, false otherwise
 */
export const verifyDeviceSignature = (
  data: string, 
  signature: string, 
  publicKey: string
): boolean => {
  try {
    // Log data but truncate if too long
    const maxLogLength = 200;
    const truncatedData = data.length > maxLogLength ? 
      data.substring(0, maxLogLength) + '...' : data;
    console.log('[AUTH] Verifying signature for data:', truncatedData);
    console.log('[AUTH] Signature (first 40 chars):', signature.substring(0, 40) + '...');
    
    // Create a unique debug directory for this verification attempt
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const debugDir = path.join(process.cwd(), 'debug', `verify-${timestamp}`);
    
    try {
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      
      // Save input data for debugging
      fs.writeFileSync(path.join(debugDir, 'data.json'), data);
      fs.writeFileSync(path.join(debugDir, 'signature.base64'), signature);
      fs.writeFileSync(path.join(debugDir, 'publicKey.txt'), publicKey);
      
      // Also save a binary version of the signature
      fs.writeFileSync(path.join(debugDir, 'signature.bin'), Buffer.from(signature, 'base64'));
      
      console.log(`[AUTH] Debug files saved to: ${debugDir}`);
    } catch (fsError) {
      console.error('[AUTH] Error writing debug files:', fsError);
      // Non-fatal, continue with verification
    }
    
    // Convert signature from base64 to buffer
    console.log('[AUTH] Converting signature from base64 to buffer');
    let signatureBuffer: Buffer;
    try {
      signatureBuffer = Buffer.from(signature, 'base64');
      console.log(`[AUTH] Signature buffer length: ${signatureBuffer.length} bytes`);
    } catch (signatureError) {
      console.error('[AUTH] Error converting signature to buffer:', signatureError);
      return false;
    }
    
    // Prepare the public key - convert from base64 if needed
    console.log('[AUTH] Preparing public key');
    let publicKeyPem = publicKey;
    if (!publicKey.includes('BEGIN PUBLIC KEY')) {
      console.log('[AUTH] Public key not in PEM format, attempting conversion from base64');
      try {
        // Convert from base64 to PEM
        publicKeyPem = Buffer.from(publicKey, 'base64').toString('utf8');
        
        // Verify that it's now in PEM format
        if (!publicKeyPem.includes('BEGIN PUBLIC KEY')) {
          console.error('[AUTH] Public key is not in PEM format after conversion');
          
          // Try to reconstruct a PEM key from raw base64
          console.log('[AUTH] Attempting to reconstruct PEM format');
          publicKeyPem = '-----BEGIN PUBLIC KEY-----\n' + 
                        publicKey.replace(/(.{64})/g, '$1\n') + 
                        '\n-----END PUBLIC KEY-----';
          
          // Write the reconstructed key for debugging
          fs.writeFileSync(path.join(debugDir, 'publicKey.reconstructed.pem'), publicKeyPem);
        }
      } catch (keyError) {
        console.error('[AUTH] Error processing public key:', keyError);
        return false;
      }
    }
    
    // Log public key info (first few lines only for security)
    const publicKeyLines = publicKeyPem.split('\n');
    console.log('[AUTH] Public key format:');
    console.log(publicKeyLines.slice(0, 3).join('\n') + '...');
    
    // Try multiple verification methods to handle different formats from OpenSSL
    console.log('[AUTH] Attempting verification with multiple methods');
    
    // Define verification method type
    type VerificationMethod = {
      name: string;
      verify: () => boolean;
    };
    
    // Before trying verification methods, log detailed data characteristics
    console.log(`[AUTH] Data being verified: ${data.substring(0, 100)}${data.length > 100 ? '...' : ''}`);
    console.log(`[AUTH] Data length: ${data.length} bytes`);
    console.log(`[AUTH] Signature length: ${signatureBuffer.length} bytes`);
    console.log(`[AUTH] Public key length: ${publicKeyPem.length} characters`);
    
    // Try parsing the data as JSON to make sure we're working with a valid object
    try {
      const parsedData = JSON.parse(data);
      console.log(`[AUTH] Data contains valid JSON with keys: ${Object.keys(parsedData).join(', ')}`);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error(`[AUTH] Data is not valid JSON: ${errorMessage}`);
    }
    
    const verificationMethods: VerificationMethod[] = [
      {
        name: 'Standard SHA256',
        verify: () => {
          const verifier = crypto.createVerify('SHA256');
          verifier.update(data);
          return verifier.verify(publicKeyPem, signatureBuffer);
        }
      },
      {
        name: 'Direct verification with padding',
        verify: () => {
          const publicKeyObj = crypto.createPublicKey(publicKeyPem);
          return crypto.verify(
            'SHA256',
            Buffer.from(data),
            {
              key: publicKeyObj,
              padding: crypto.constants.RSA_PKCS1_PADDING
            },
            signatureBuffer
          );
        }
      },
      {
        name: 'Hyphenated SHA-256',
        verify: () => {
          const verifier = crypto.createVerify('SHA-256');
          verifier.update(data);
          return verifier.verify(publicKeyPem, signatureBuffer);
        }
      },
      {
        name: 'Lowercase sha256',
        verify: () => {
          const verifier = crypto.createVerify('sha256');
          verifier.update(data);
          return verifier.verify(publicKeyPem, signatureBuffer);
        }
      },
      {
        name: 'RSA-SHA256',
        verify: () => {
          const verifier = crypto.createVerify('RSA-SHA256');
          verifier.update(data);
          return verifier.verify(publicKeyPem, signatureBuffer);
        }
      },
      {
        name: 'Binary data format',
        verify: () => {
          const verifier = crypto.createVerify('SHA256');
          verifier.update(Buffer.from(data));
          return verifier.verify(publicKeyPem, signatureBuffer);
        }
      },
      {
        name: 'With different signature encoding',
        verify: () => {
          // Try with URL-safe base64 decoding
          try {
            const urlSafeBase64 = signature.replace(/-/g, '+').replace(/_/g, '/');
            const buffer = Buffer.from(urlSafeBase64, 'base64');
            const verifier = crypto.createVerify('SHA256');
            verifier.update(data);
            return verifier.verify(publicKeyPem, buffer);
          } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error(`[AUTH] URL-safe base64 error: ${errorMessage}`);
            return false;
          }
        }
      },
      {
        name: 'With normalized line endings',
        verify: () => {
          // Try normalizing line endings in the data
          const normalizedData = data.replace(/\r\n/g, '\n');
          const verifier = crypto.createVerify('SHA256');
          verifier.update(normalizedData);
          return verifier.verify(publicKeyPem, signatureBuffer);
        }
      },
      {
        name: 'With data hash directly',
        verify: () => {
          // Try using the data hash directly
          const dataHash = crypto.createHash('sha256').update(data).digest();
          
          try {
            // Create a public key object
            const publicKeyObj = crypto.createPublicKey(publicKeyPem);
            
            // Verify the signature against the hash
            return crypto.verify(
              null, // No algorithm needed since we're providing the hash directly
              dataHash,
              {
                key: publicKeyObj,
                padding: crypto.constants.RSA_PKCS1_PADDING
              },
              signatureBuffer
            );
          } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            console.error(`[AUTH] Data hash verification error: ${errorMessage}`);
            return false;
          }
        }
      }
    ];
    
    // Try each method until one succeeds
    let methodResults: Array<{method: string, result?: boolean, error?: string}> = [];
    
    for (const method of verificationMethods) {
      try {
        console.log(`[AUTH] Trying verification method: ${method.name}`);
        const result = method.verify();
        methodResults.push({ method: method.name, result });
        
        if (result) {
          console.log(`[AUTH] ✅ Verification successful with method: ${method.name}`);
          
          // Save successful method for debugging
          try {
            fs.writeFileSync(
              path.join(debugDir, 'successful_method.txt'),
              `Method: ${method.name}\nResult: ${result}`
            );
          } catch (e) {
            // Ignore file write errors
          }
          
          return true;
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        methodResults.push({ method: method.name, error: errorMessage });
        console.error(`[AUTH] ❌ Error with method ${method.name}:`, error);
        // Continue to next method
      }
    }
    
    // Save detailed results for debugging
    try {
      fs.writeFileSync(
        path.join(debugDir, 'verification_results.json'),
        JSON.stringify(methodResults, null, 2)
      );
    } catch (e) {
      // Ignore file write errors
    }
    
    console.error('[AUTH] ❌ All verification methods failed');
    return false;
  } catch (error) {
    console.error('[AUTH] Unexpected error in signature verification:', error);
    if (error instanceof Error) {
      console.error('[AUTH] Error name:', error.name);
      console.error('[AUTH] Error message:', error.message);
      console.error('[AUTH] Error stack:', error.stack);
    }
    return false;
  }
};

/**
 * Generate a random challenge for device authentication
 * 
 * @param length Length of the challenge in bytes (default: 32)
 * @returns Base64-encoded random challenge
 */
export const generateChallenge = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('base64');
};

/**
 * Format a public key as PEM if it's not already
 * 
 * @param publicKey The public key (may be in PEM or base64 format)
 * @returns The public key in PEM format
 */
export const formatPublicKey = (publicKey: string): string | null => {
  try {
    // Check if it's already in PEM format
    if (publicKey.includes('BEGIN PUBLIC KEY')) {
      return publicKey;
    }
    
    // Try to convert from base64 to PEM
    const decoded = Buffer.from(publicKey, 'base64').toString('utf8');
    
    // Check if the decoded string is in PEM format
    if (decoded.includes('BEGIN PUBLIC KEY')) {
      return decoded;
    }
    
    // It's probably raw key data, so wrap it in PEM format
    console.error('[AUTH] Public key is not in a recognized format');
    return null;
  } catch (error) {
    console.error('[AUTH] Error formatting public key:', error);
    return null;
  }
};