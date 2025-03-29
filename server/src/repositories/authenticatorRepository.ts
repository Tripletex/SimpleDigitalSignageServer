import { Authenticator } from '../models/Authenticator';
import { User } from '../models/User';
import { generateUUID } from '../utils/helpers';

class AuthenticatorRepository {
  /**
   * Create a new authenticator for a user
   */
  async createAuthenticator(
    userId: string,
    credentialId: string,
    publicKey: string,
    counter: string,
    deviceType: string,
    transports?: string[],
    fmt?: string
  ): Promise<Authenticator> {
    // Convert transports array to string if provided
    const transportsStr = transports ? transports.join(',') : undefined;
    
    // Create authenticator
    const authenticator = await Authenticator.create({
      id: generateUUID(),
      userId,
      credentialId,
      publicKey,
      counter,
      deviceType,
      transports: transportsStr,
      fmt
    });
    
    return authenticator;
  }
  
  /**
   * Get an authenticator by credential ID
   */
  async getAuthenticatorByCredentialId(credentialId: string): Promise<Authenticator | null> {
    return await Authenticator.findOne({
      where: { credentialId },
      include: [User]
    });
  }
  
  /**
   * Get all authenticators for a user
   */
  async getAuthenticatorsByUserId(userId: string): Promise<Authenticator[]> {
    return await Authenticator.findAll({
      where: { userId }
    });
  }
  
  /**
   * Update authenticator counter
   */
  async updateAuthenticatorCounter(credentialId: string, counter: string): Promise<Authenticator | null> {
    const [updateCount] = await Authenticator.update(
      { counter },
      { where: { credentialId } }
    );
    
    if (updateCount === 0) {
      return null;
    }
    
    return await this.getAuthenticatorByCredentialId(credentialId);
  }
  
  /**
   * Delete authenticator
   */
  async deleteAuthenticator(id: string): Promise<boolean> {
    const deletedCount = await Authenticator.destroy({
      where: { id }
    });
    
    return deletedCount > 0;
  }
}

export default new AuthenticatorRepository();