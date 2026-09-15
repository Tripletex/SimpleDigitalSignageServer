import { db, testConnection, closeConnection } from '../db/client.ts';
import { users } from '../db/schema/users.ts';

console.log('Testing Drizzle + postgres driver...');
try {
  const connected = await testConnection();
  if (!connected) throw new Error('Connection failed');

  const allUsers = await db.select().from(users).limit(5);
  console.log(`SUCCESS: Found ${allUsers.length} users`);
  if (allUsers.length > 0) {
    console.log('First user email:', allUsers[0].email);
  }
} catch (e) {
  console.error('FAILED:', e);
} finally {
  await closeConnection();
}
