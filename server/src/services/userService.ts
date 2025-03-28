import { User, UserRole } from '../../../shared/src/userData';
import userRepository from '../repositories/userRepository';

class UserService {
  /**
   * Create a new user
   */
  async createUser(email: string, displayName?: string, role: UserRole = UserRole.USER): Promise<User> {
    // Check if user exists
    const existingUser = await userRepository.getUserByEmail(email);
    if (existingUser) {
      throw new Error(`Email ${email} already exists`);
    }
    
    // Create user
    return await userRepository.createUser(email, displayName, role);
  }

  /**
   * Get a user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    return await userRepository.getUserById(id);
  }

  /**
   * Get a user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return await userRepository.getUserByEmail(email);
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<User[]> {
    return await userRepository.getAllUsers();
  }

  /**
   * Update a user
   */
  async updateUser(user: Partial<User> & { id: string }): Promise<User | null> {
    return await userRepository.updateUser(user);
  }

  /**
   * Delete a user
   */
  async deleteUser(id: string): Promise<void> {
    await userRepository.deleteUser(id);
  }

  /**
   * Create the initial admin user if no users exist
   */
  async createInitialAdminIfNeeded(): Promise<void> {
    const users = await userRepository.getAllUsers();
    
    if (users.length === 0) {
      console.log('No users found, creating initial admin user');
      
      try {
        await userRepository.createUser(
          'admin@example.com',
          'Administrator',
          UserRole.ADMIN
        );
        
        console.log('Created initial admin user: admin@example.com');
      } catch (error) {
        console.error('Failed to create initial admin user:', error);
      }
    }
  }
}

export default new UserService();