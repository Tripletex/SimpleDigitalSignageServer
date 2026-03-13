import { generateRegistrationOptions } from '@simplewebauthn/server';

console.log('Testing @simplewebauthn/server in Deno...');
try {
  const options = await generateRegistrationOptions({
    rpName: 'Test',
    rpID: 'localhost',
    userName: 'test@test.com',
  });
  console.log('SUCCESS: generateRegistrationOptions works');
  console.log('Challenge generated:', options.challenge.substring(0, 20) + '...');
} catch (e) {
  console.error('FAILED:', e);
  Deno.exit(1);
}
