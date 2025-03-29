import { EmailVerification } from '../models/EmailVerification';
import { Op } from 'sequelize';
import { TenantRole } from '../../../shared/src/tenantData';

class EmailVerificationService {
  /**
   * Create an email verification token
   */
  async createEmailVerificationToken(email: string, isFirstUser: boolean = false): Promise<string> {
    // Check if there's an existing token for this email
    const existingVerification = await EmailVerification.findOne({
      where: {
        email,
        expiresAt: {
          [Op.gt]: new Date()
        },
        // Ensure it's not an invitation token
        invitingTenantId: null
      }
    });
    
    if (existingVerification) {
      console.log(`Using existing verification token for ${email}`);
      
      // Update the isFirstUser flag if needed
      if (isFirstUser && !existingVerification.isFirstUser) {
        existingVerification.isFirstUser = true;
        await existingVerification.save();
      }
      
      return existingVerification.token;
    }
    
    // Generate a token before creating the record
    const token = EmailVerification.generateToken();
    
    // Create a new verification token
    const verification = await EmailVerification.create({
      email,
      isFirstUser,
      token
    });
    
    console.log(`Created verification token for ${email}: ${verification.token}`);
    return verification.token;
  }
  
  /**
   * Create an invitation token for a user who hasn't registered yet
   */
  async createInvitationToken(email: string, tenantId: string, role: TenantRole): Promise<string> {
    // Check if there's an existing invitation token for this email and tenant
    const existingInvitation = await EmailVerification.findOne({
      where: {
        email,
        invitingTenantId: tenantId,
        expiresAt: {
          [Op.gt]: new Date()
        }
      }
    });
    
    if (existingInvitation) {
      console.log(`Using existing invitation token for ${email} to tenant ${tenantId}`);
      
      // Update the role if it has changed
      if (existingInvitation.invitedRole !== role) {
        existingInvitation.invitedRole = role;
        await existingInvitation.save();
      }
      
      return existingInvitation.token;
    }
    
    // Generate a token before creating the record
    const token = EmailVerification.generateToken();
    
    // Create a new invitation token
    const invitation = await EmailVerification.create({
      email,
      invitingTenantId: tenantId,
      invitedRole: role,
      isFirstUser: false, // Invitations are never for first users
      token
    });
    
    console.log(`Created invitation token for ${email} to tenant ${tenantId}: ${invitation.token}`);
    return invitation.token;
  }
  
  /**
   * Verify an email verification token
   */
  async verifyEmailToken(token: string): Promise<{
    email: string,
    isFirstUser: boolean,
    isInvitation: boolean,
    invitingTenantId?: string,
    invitedRole?: string
  } | null> {
    // Find the verification record
    const verification = await EmailVerification.findOne({
      where: {
        token,
        expiresAt: {
          [Op.gt]: new Date()
        }
      }
    });
    
    if (!verification) {
      console.log(`Invalid or expired token: ${token}`);
      return null;
    }
    
    const isInvitation = !!verification.invitingTenantId;
    
    const result = {
      email: verification.email,
      isFirstUser: verification.isFirstUser,
      isInvitation,
      invitingTenantId: verification.invitingTenantId,
      invitedRole: verification.invitedRole
    };
    
    // In a production environment, we would typically reset the token or add a "verified" flag
    // But for this implementation, we'll let the token remain valid until it expires or is used to complete registration
    // This allows the user to reload the page during the registration process without losing state
    
    if (isInvitation) {
      console.log(`Verified invitation for ${result.email} to tenant ${result.invitingTenantId} with token ${token}`);
    } else {
      console.log(`Verified email ${result.email} with token ${token}`);
    }
    
    // We don't delete the token yet, but we will need to delete it once registration is complete
    
    return result;
  }
  
  /**
   * Clean up expired email verification tokens
   */
  async cleanExpiredEmailVerifications(): Promise<number> {
    const now = new Date();
    const deletedCount = await EmailVerification.destroy({
      where: {
        expiresAt: {
          [Op.lt]: now
        }
      }
    });
    
    console.log(`Cleaned up ${deletedCount} expired email verifications`);
    return deletedCount;
  }
}

export default new EmailVerificationService();