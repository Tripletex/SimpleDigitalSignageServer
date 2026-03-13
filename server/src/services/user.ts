import userRepository from '../repositories/user.ts';
import tenantRepository from '../repositories/tenant.ts';

const userService = {
  async createUser(data: {
    email: string;
    displayName?: string;
    role?: 'admin' | 'user';
  }) {
    return userRepository.createUser(data);
  },

  async getUserById(id: string) {
    return userRepository.getUserById(id);
  },

  async getUserByEmail(email: string) {
    return userRepository.getUserByEmail(email);
  },

  async getAllUsers() {
    return userRepository.getAllUsers();
  },

  async updateUser(id: string, data: Partial<{
    email: string;
    displayName: string;
    role: 'admin' | 'user';
  }>) {
    return userRepository.updateUser(id, data);
  },

  async deleteUser(id: string) {
    return userRepository.deleteUser(id);
  },

  /**
   * Check if any users exist. If not, log that no users were found.
   * Does not create an admin automatically.
   */
  async createInitialAdminIfNeeded(): Promise<void> {
    const users = await userRepository.getAllUsers();
    if (users.length === 0) {
      console.log('[UserService] No users found in database. An admin user needs to be created.');
    }
  },

  /**
   * Process new user tenant setup:
   * 1. Create a personal tenant for the user
   * 2. Accept any pending invitations for the user's email
   */
  async processNewUserTenantSetup(userId: string, email: string): Promise<void> {
    // Create personal tenant
    await tenantRepository.createPersonalTenantIfNeeded(userId, email);

    // Accept pending invitations
    const pendingInvitations = await tenantRepository.getPendingInvitationsByEmail(email);

    for (const invitation of pendingInvitations) {
      // Add user as a member of the invited tenant
      await tenantRepository.addTenantMember({
        tenantId: invitation.tenantId,
        userId,
        role: invitation.role as 'owner' | 'admin' | 'member',
        status: 'active',
        invitedById: invitation.invitedById ?? undefined,
      });

      // Delete the processed invitation
      await tenantRepository.deletePendingInvitation(invitation.id);
    }
  },
};

export default userService;
