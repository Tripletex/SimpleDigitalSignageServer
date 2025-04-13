/**
 * This test script verifies that we can correctly sign and verify
 * a device challenge in exactly the same way as the bash script.
 */
const fs = require('fs');
const crypto = require('crypto');

// This simulates the direct generation and encode/decode process
console.log('=== Test 1: Direct Node.js Key Generation and Verification ===');

// Generate a test key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Convert public key to base64 as it would be stored in the database
const publicKeyBase64 = Buffer.from(publicKey).toString('base64');

// Test data to sign (like the challenge)
const dataToSign = JSON.stringify({ deviceId: 'test123', challenge: 'abc123' });

// Create a signature using Node's crypto
const sign = crypto.createSign('SHA256');
sign.update(dataToSign);
const signature = sign.sign(privateKey);
const signatureBase64 = signature.toString('base64');

// Now try to verify the signature
const verify = crypto.createVerify('SHA256');
verify.update(dataToSign);

// Decode the base64 public key back to PEM
const decodedPublicKey = Buffer.from(publicKeyBase64, 'base64').toString('utf8');

const result = verify.verify(decodedPublicKey, Buffer.from(signatureBase64, 'base64'));
console.log('Signature verification result:', result);

// Now let's try a simple approach with predefined keys to verify
console.log('\n=== Test 2: Simple Key Verification ===');

// Fixed test data and key
const testData = '{"test":"data"}';
const testPrivateKey = `
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDEDLzh8YWi+ftB
HZ0lU1NbDFxwn1H7JnENTJXudCLJ8xI+nNHGcR7IrQxY65zTvKF6ztbk5iN1R3xX
hZHzEeP5/M4hKBmtfxRMp/kWJ5U+cIVRW3mxMSTPhLDJkG+QVTmNfGkLuHpFuA6A
vVBsaEPQbQgRRl0jNUBLs9+Y2M9Tu+hxJEZ72CPcQa9/RLGmDNQUk7BwBZk/S3KX
Oaxk7DS3vNMfojlFZvXOcHX4Hf+uzn3yd+muH9/BH7AxVjGcEcQOZfhaUUX2ywSz
fKThOY90nXvYR7+fZrLYWXxC6Wz5oQTYl5N2RYxbDY2XqzTOHbCPFLvfQBrYY+KO
F3JXeuxrAgMBAAECggEAGbqFXBSEqYfftpzWQlgQm+9Ejzb2FcEayaIRU5hKiGAx
Z/sX70+1/g8QqIgFgNg6Zyk9AkYYeXOFGM/pzqZa8C9Dsrn/FgB5Bj9eNfNYAH7X
0z3dx0c1qKAGTYYCnvWPTpkWFTR+fiFSK1wSOWNB2/i0JH4NPkuEKGrzZtpz9Xzg
fB3cTDm80X8ghEuQ1e5thMULbNYQcMsFTL2ooSXKQB6BzKDab/GBWZaXMcXJCMbg
APQs8JCaWFeq45ZmM0Ppw5/r9CfykVomK/dJBiP0KWaifzXCJe/E5rSV0QTl9sBl
3A9bj3slPwD1dAHPwLb83mnAT5YIKuJaQJTHF31CeQKBgQD+1gu1rAoXjCjSvmUE
QVRCkecO23hWbOsECTJuEjKFUUCOlUr9ywGqRrQBqhYJ+zYUwKCRzKkI9yV68LQK
3YvXvEe88rzcdkIOSyJWXYeYJGG8SqWE8lrWbgJNUbW7nA9VJhxJ5PQHqjQzm6FL
R/bXe3mq2SWmdGO1A8Xjij5IzwKBgQDFAOLz5J7YmP+0XxQ7hzGZOdKRBriGVUQM
eMgBtXgO+XUi0opcSYWpJiLsUU1JhhQ1NC8nrjUZ/6XYCGK3LnB5ABQXvHWHhCDi
v1ODfVbTfEleY4EFH4v7+rRx4bv0OZRgdGGGq9UYVcJP6FbBc79+y4MmJ/Q4Qx3H
t+t+MMsGtQKBgF/+uzVH/2RcI4G1KAOrKZPpfM23+uwW/Nn2r+JJK5hR5rrQfPZc
w2+CXiMsH5nQ3r9VQA8ZvCcAWZZrGMTuJnkJ9QIYKsHNOCAoyA57LpmCJnXeeeAZ
QnuIyMXgOeQqkZLnIyEH/pDwgE5jI4fIE85OgLWCHnJxNuUkN/COwdLhAoGAR0Xn
W3BEXQ2cFVlGfbO6SKa/fj6+rhP72UvjWKj89y+p/MQwjY5pON9qAVcnXO7vgzw9
YAp1uGcAoOZXx3Gc5NhYngyYz8fq0ysiAK9rAOSsKhZLDYAVw5+nQ3r3f4kZNLmD
7a4R/g2iRTZYLqfqZQbDikYHUmRCDhf9E2y4PwECgYEAqMC7ij9XS49yrwLX4gQe
CxJJETpVXAQnIJhJMNxGOpAO9B0kEad9z8sBdRkGGjD4FvJ/eGKwMTFLSBF1vYYg
zMr+FqdE8LWuQ6tQaHwYuhw6NRHoZBTZz4owTrq0ZTLj9Fv16C3bIBcUAajuv8oF
XdT9vXItXv2Y9gQhD0Pk5CI=
-----END PRIVATE KEY-----
`;

const testPublicKey = `
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxAy84fGFovn7QR2dJVNT
WwxccJ9R+yZxDUyV7nQiyfMSPpzRxnEeyK0MWOuc07yher7W5OYjdUd8V4WR8xHj
+fzOISgZrX8UTKf5FieVPnCFUVt5sTEkz4SwyZBvkFU5jXxpC7h6RbgOgL1QbGhD
0G0IEUZdIzVAS7PfmNjPU7vocSRGe9gj3EGvf0Sxpgzg==
-----END PUBLIC KEY-----
`;

// Sign the test data
const testSign = crypto.createSign('SHA256');
testSign.update(testData);
const testSignature = testSign.sign(testPrivateKey);

// Now verify
const testVerify = crypto.createVerify('SHA256');
testVerify.update(testData);
console.log('Test verification result:', testVerify.verify(testPublicKey, testSignature));

// Let's also test the endpoint simulation
console.log('\n=== Test 3: Challenge-Response Simulation ===');

// 1. Generate a challenge
const challenge = crypto.randomBytes(32).toString('base64');
console.log('Generated challenge:', challenge);

// 2. Create the data to sign
const challengeData = JSON.stringify({ deviceId: 'test-device', challenge });

// 3. Sign it with the test private key
const authSign = crypto.createSign('SHA256');
authSign.update(challengeData);
const authSignature = authSign.sign(testPrivateKey).toString('base64');

// 4. Verify the signature
const authVerify = crypto.createVerify('SHA256');
authVerify.update(challengeData);
console.log('Auth verification result:', authVerify.verify(testPublicKey, Buffer.from(authSignature, 'base64')));

// This simulates how we store and retrieve the public key
const base64PublicKey = Buffer.from(testPublicKey).toString('base64');
const retrievedPublicKey = Buffer.from(base64PublicKey, 'base64').toString('utf8');

console.log('Public keys match?', testPublicKey.trim() === retrievedPublicKey.trim());

// Try the full verification flow with the retrieved key
const finalVerify = crypto.createVerify('SHA256');
finalVerify.update(challengeData);
console.log('Final verification with retrieved key:', finalVerify.verify(retrievedPublicKey, Buffer.from(authSignature, 'base64')));