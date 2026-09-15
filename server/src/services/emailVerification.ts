import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { emailVerifications } from '../db/schema/index.ts';
import { uuidv7 } from '../utils/helpers.ts';

const emailVerificationService = {
  /**
   * Create an email verification record with a random token.
   * Token expires after 24 hours.
   */
  async createEmailVerification(
    email: string,
    isFirstUser?: boolean,
    invitingTenantId?: string,
    invitedRole?: string,
  ): Promise<string> {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(emailVerifications).values({
      id: uuidv7(),
      email,
      token,
      isFirstUser: isFirstUser ?? false,
      invitingTenantId: invitingTenantId ?? null,
      invitedRole: invitedRole ?? null,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return token;
  },

  /**
   * Verify an email token. Returns the verification data if found and not expired,
   * or null otherwise.
   */
  async verifyEmailToken(token: string) {
    const verification = await db.query.emailVerifications.findFirst({
      where: and(
        eq(emailVerifications.token, token),
        sql`${emailVerifications.expiresAt} > now()`,
      ),
    });

    return verification ?? null;
  },

  /**
   * Delete a verification record by id.
   */
  async deleteVerification(id: string): Promise<void> {
    await db.delete(emailVerifications)
      .where(eq(emailVerifications.id, id));
  },

  /**
   * Delete all expired email verifications. Returns the count of deleted records.
   */
  async cleanExpiredEmailVerifications(): Promise<number> {
    const result = await db.delete(emailVerifications)
      .where(sql`${emailVerifications.expiresAt} < now()`)
      .returning();
    return result.length;
  },
};

export default emailVerificationService;
