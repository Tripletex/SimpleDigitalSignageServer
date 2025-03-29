import { User } from '../models/User';
import { Authenticator } from '../models/Authenticator';
import { generateUUID } from '../utils/helpers';
import { UserRole, Authenticator as SharedAuthenticator } from '../../../shared/src/userData';

class UserRepository {
  /**
   * Create a new user
   */
  async createUser(email: string, displayName?: string, role: UserRole = UserRole.USER): Promise<User> {
    // Check if user exists
    const existingUser = await this.getUserByEmail(email);
    if (existingUser) {
      throw new Error(`User with email ${email} already exists`);
    }
    
    // Create user
    const user = await User.create({
      id: generateUUID(),
      email,
      displayName,
      role
    });
    
    return user;
  }

  /**
   * Get a user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    return await User.findByPk(id, {
      include: [Authenticator]
    });
  }

  /**
   * Get a user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return await User.findOne({
      where: { email },
      include: [Authenticator]
    });
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<User[]> {
    return await User.findAll({
      include: [Authenticator]
    });
  }

  /**
   * Update a user
   */
  async updateUser(user: Partial<User> & { id: string }): Promise<User | null> {
    const [updateCount] = await User.update(user, {
      where: { id: user.id }
    });
    
    if (updateCount === 0) {
      return null;
    }
    
    return await this.getUserById(user.id);
  }

  /**
   * Delete a user
   */
  async deleteUser(id: string): Promise<boolean> {
    // First delete all authenticators
    await Authenticator.destroy({
      where: { userId: id }
    });
    
    // Then delete the user
    const deletedCount = await User.destroy({
      where: { id }
    });
    
    return deletedCount > 0;
  }
  
  /**
   * Add an authenticator to a user
   */
  async addAuthenticator(userId: string, authenticatorData: SharedAuthenticator): Promise<Authenticator> {
    const authenticator = await Authenticator.create({
      id: generateUUID(),
      userId,
      credentialId: authenticatorData.credentialID,
      publicKey: authenticatorData.credentialPublicKey,
      counter: authenticatorData.counter.toString(),
      deviceType: authenticatorData.credentialDeviceType,
      // Convert transports array to string if it exists
      transports: authenticatorData.transports ? JSON.stringify(authenticatorData.transports) : null
    });
    
    return authenticator;
  }
  
  /**
   * Get an authenticator by credential ID
   */
  async getAuthenticatorByCredentialId(credentialId: string): Promise<Authenticator | null> {
    return await Authenticator.findOne({
      where: { credentialId }
    });
  }
  
  /**
   * Update an authenticator's counter
   */
  async updateAuthenticatorCounter(credentialId: string, counter: number): Promise<boolean> {
    const [updateCount] = await Authenticator.update(
      { counter: counter.toString() },
      { where: { credentialId } }
    );
    
    return updateCount > 0;
  }
}

export default new UserRepository();