import { User as SharedUser, UserRole, Authenticator as SharedAuthenticator } from '../../../shared/src/userData';
import userRepository from '../repositories/userRepository';
import tenantRepository from '../repositories/tenantRepository';
import { User } from '../models/User';
import { Authenticator } from '../models/Authenticator';
import { TenantMemberStatus } from '../../../shared/src/tenantData';

/**
 * Convert model user to shared user type
 */
function mapUserToSharedUser(user: User | null): SharedUser | null {
  if (!user) return null;
  
  // Map authenticators if they exist
  const authenticators = user.authenticators?.map(auth => mapAuthenticatorToSharedAuthenticator(auth)) || [];
  
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
    role: user.role as UserRole,
    authenticators,
  };
}

/**
 * Convert model authenticator to shared authenticator type
 */
function mapAuthenticatorToSharedAuthenticator(auth: Authenticator): SharedAuthenticator {
  let transports: string[] = [];
  
  // Parse transports if they exist and are a string
  if (auth.transports) {
    try {
      transports = JSON.parse(auth.transports);
    } catch (e) {
      console.error('Error parsing transports:', e);
    }
  }
  
  return {
    credentialID: auth.credentialId,
    credentialPublicKey: auth.publicKey,
    counter: typeof auth.counter === 'string' ? parseInt(auth.counter, 10) : 0,
    credentialDeviceType: auth.deviceType,
    credentialBackedUp: false, // Default value since it's not in the model
    transports,
  };
}

class UserService {
  /**
   * Create a new user
   */
  async createUser(email: string, displayName?: string, role: UserRole = UserRole.USER): Promise<SharedUser> {
    // Check if user exists
    const existingUser = await userRepository.getUserByEmail(email);
    if (existingUser) {
      throw new Error(`Email ${email} already exists`);
    }
    
    // Create user
    const user = await userRepository.createUser(email, displayName, role);
    
    // Process any pending invitations for this email
    await this.processPendingInvitations(email, user.id);
    
    return mapUserToSharedUser(user) as SharedUser;
  }
  
  /**
   * Process pending invitations for a newly registered user
   */
  private async processPendingInvitations(email: string, userId: string): Promise<void> {
    try {
      console.log(`Processing pending invitations for ${email}`);
      
      // Get all pending invitations for this email
      const pendingInvitations = await tenantRepository.getPendingInvitationsByEmail(email);
      
      console.log(`Found ${pendingInvitations.length} pending invitations for ${email}`);
      
      // Process each invitation
      for (const invitation of pendingInvitations) {
        try {
          console.log(`Processing invitation to tenant ${invitation.tenantId} with role ${invitation.role}`);
          
          // Check if user already has membership (shouldn't happen, but to be safe)
          const existingMembership = await tenantRepository.getTenantMember(invitation.tenantId, userId);
          
          if (existingMembership) {
            console.log(`User already has membership in tenant ${invitation.tenantId}, skipping invitation`);
            continue;
          }
          
          // Create tenant membership for the user as active (not pending)
          await tenantRepository.addTenantMember(
            invitation.tenantId,
            userId,
            invitation.role,
            TenantMemberStatus.ACTIVE, // Active immediately since this is during registration
            invitation.invitedById
          );
          
          console.log(`Created tenant membership for user ${userId} in tenant ${invitation.tenantId}`);
          
          // Delete the pending invitation
          await tenantRepository.deletePendingInvitation(invitation.id);
          
          console.log(`Deleted processed invitation ${invitation.id}`);
        } catch (error) {
          console.error(`Error processing invitation ${invitation.id}:`, error);
          // Continue with other invitations even if one fails
        }
      }
    } catch (error) {
      console.error(`Error processing pending invitations for ${email}:`, error);
      // Don't fail user creation if invitation processing fails
    }
  }

  /**
   * Get a user by ID
   */
  async getUserById(id: string): Promise<SharedUser | null> {
    const user = await userRepository.getUserById(id);
    return mapUserToSharedUser(user);
  }

  /**
   * Get a user by email
   */
  async getUserByEmail(email: string): Promise<SharedUser | null> {
    const user = await userRepository.getUserByEmail(email);
    return mapUserToSharedUser(user);
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<SharedUser[]> {
    const users = await userRepository.getAllUsers();
    return users.map(user => mapUserToSharedUser(user) as SharedUser);
  }

  /**
   * Update a user
   */
  async updateUser(userData: Partial<SharedUser> & { id: string }): Promise<SharedUser | null> {
    // Convert shared user data to model user data
    const modelUserData = {
      id: userData.id,
      email: userData.email,
      displayName: userData.displayName,
      role: userData.role
    };
    
    const user = await userRepository.updateUser(modelUserData);
    return mapUserToSharedUser(user);
  }

  /**
   * Delete a user
   */
  async deleteUser(id: string): Promise<void> {
    await userRepository.deleteUser(id);
  }

  /**
   * Check if users exist and log a message if not - but don't create any example users 
   */
  async createInitialAdminIfNeeded(): Promise<void> {
    const users = await userRepository.getAllUsers();
    
    if (users.length === 0) {
      console.log('No users found. No automatic user creation is enabled - please create an admin user manually.');
    } else {
      console.log(`Found ${users.length} existing users in the database.`);
    }
  }
  
    // Email verification functionality is now in emailVerificationService
}

export default new UserService();