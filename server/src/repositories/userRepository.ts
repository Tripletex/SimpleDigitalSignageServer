import { v4 as uuidv4 } from 'uuid';
import { 
  PutCommand, 
  GetCommand, 
  ScanCommand, 
  QueryCommand,
  UpdateCommand,
  DeleteCommand 
} from '@aws-sdk/lib-dynamodb';
import { docClient, USER_TABLE, AUTHENTICATOR_TABLE } from '../config/dynamoDb';
import { User, UserRole, Authenticator } from '../../../shared/src/userData';

class UserRepository {
  // User operations
  async createUser(email: string, displayName?: string, role: UserRole = UserRole.USER): Promise<User> {
    const id = uuidv4();
    const createdAt = new Date();
    
    // Generate display name from email if not provided
    const finalDisplayName = displayName || email.split('@')[0];
    
    const user: User = {
      id,
      email,
      displayName: finalDisplayName,
      createdAt,
      role
    };
    
    const command = new PutCommand({
      TableName: USER_TABLE,
      Item: {
        id,
        email,
        displayName: finalDisplayName,
        createdAt: createdAt.toISOString(),
        role
      },
      // Make sure email is unique
      ConditionExpression: 'attribute_not_exists(email)'
    });
    
    try {
      await docClient.send(command);
      return user;
    } catch (error) {
      if ((error as any).name === 'ConditionalCheckFailedException') {
        throw new Error(`Email ${email} already exists`);
      }
      throw error;
    }
  }

  async getUserById(id: string): Promise<User | null> {
    const command = new GetCommand({
      TableName: USER_TABLE,
      Key: { id }
    });
    
    const response = await docClient.send(command);
    if (!response.Item) return null;
    
    const authenticators = await this.getAuthenticatorsByUserId(id);
    
    return {
      id: response.Item.id,
      email: response.Item.email,
      displayName: response.Item.displayName,
      createdAt: new Date(response.Item.createdAt),
      role: response.Item.role,
      authenticators: authenticators.length > 0 ? authenticators : undefined
    };
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const command = new QueryCommand({
      TableName: USER_TABLE,
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    });
    
    const response = await docClient.send(command);
    if (!response.Items || response.Items.length === 0) return null;
    
    const user = response.Items[0];
    const authenticators = await this.getAuthenticatorsByUserId(user.id);
    
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: new Date(user.createdAt),
      role: user.role,
      authenticators: authenticators.length > 0 ? authenticators : undefined
    };
  }

  async getAllUsers(): Promise<User[]> {
    console.log(`Scanning ${USER_TABLE} table for users...`);
    const command = new ScanCommand({
      TableName: USER_TABLE
    });
    
    const response = await docClient.send(command);
    const items = response.Items || [];
    console.log(`Found ${items.length} users in ${USER_TABLE}`);
    
    // For each user, get their authenticators
    const users = await Promise.all(
      items.map(async (item) => {
        const authenticators = await this.getAuthenticatorsByUserId(item.id);
        return {
          id: item.id,
          email: item.email,
          displayName: item.displayName,
          createdAt: new Date(item.createdAt),
          role: item.role,
          authenticators: authenticators.length > 0 ? authenticators : undefined
        };
      })
    );
    
    return users;
  }

  async updateUser(user: Partial<User> & { id: string }): Promise<User | null> {
    // Don't allow updating email (would need to check uniqueness)
    const { id, email, ...updateFields } = user;
    
    // Build update expression and attribute values
    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};
    
    Object.entries(updateFields).forEach(([key, value]) => {
      if (value !== undefined) {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });
    
    if (updateExpressions.length === 0) {
      // Nothing to update
      return await this.getUserById(id);
    }
    
    const command = new UpdateCommand({
      TableName: USER_TABLE,
      Key: { id },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    });
    
    const response = await docClient.send(command);
    if (!response.Attributes) return null;
    
    const authenticators = await this.getAuthenticatorsByUserId(id);
    
    return {
      id,
      email: response.Attributes.email,
      displayName: response.Attributes.displayName,
      createdAt: new Date(response.Attributes.createdAt),
      role: response.Attributes.role,
      authenticators: authenticators.length > 0 ? authenticators : undefined
    };
  }

  async deleteUser(id: string): Promise<void> {
    // Delete all user's authenticators first
    const authenticators = await this.getAuthenticatorsByUserId(id);
    
    for (const authenticator of authenticators) {
      await this.deleteAuthenticator(authenticator.credentialID);
    }
    
    // Delete the user
    const command = new DeleteCommand({
      TableName: USER_TABLE,
      Key: { id }
    });
    
    await docClient.send(command);
  }

  // Authenticator operations  
  async addAuthenticator(userId: string, authenticator: Authenticator): Promise<void> {
    const command = new PutCommand({
      TableName: AUTHENTICATOR_TABLE,
      Item: {
        credentialID: authenticator.credentialID,
        userId,
        credentialPublicKey: authenticator.credentialPublicKey,
        counter: authenticator.counter,
        credentialDeviceType: authenticator.credentialDeviceType,
        credentialBackedUp: authenticator.credentialBackedUp,
        transports: authenticator.transports
      }
    });
    
    await docClient.send(command);
  }

  async getAuthenticatorByCredentialId(credentialId: string): Promise<(Authenticator & { userId: string }) | null> {
    const command = new GetCommand({
      TableName: AUTHENTICATOR_TABLE,
      Key: { credentialID: credentialId }
    });
    
    const response = await docClient.send(command);
    if (!response.Item) return null;
    
    return {
      credentialID: response.Item.credentialID,
      userId: response.Item.userId,
      credentialPublicKey: response.Item.credentialPublicKey,
      counter: response.Item.counter,
      credentialDeviceType: response.Item.credentialDeviceType,
      credentialBackedUp: response.Item.credentialBackedUp,
      transports: response.Item.transports
    };
  }

  async getAuthenticatorsByUserId(userId: string): Promise<Authenticator[]> {
    const command = new QueryCommand({
      TableName: AUTHENTICATOR_TABLE,
      IndexName: 'UserIdIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    });
    
    const response = await docClient.send(command);
    if (!response.Items || response.Items.length === 0) return [];
    
    return response.Items.map(item => ({
      credentialID: item.credentialID,
      credentialPublicKey: item.credentialPublicKey,
      counter: item.counter,
      credentialDeviceType: item.credentialDeviceType,
      credentialBackedUp: item.credentialBackedUp,
      transports: item.transports
    }));
  }

  async updateAuthenticatorCounter(credentialId: string, counter: number): Promise<void> {
    const command = new UpdateCommand({
      TableName: AUTHENTICATOR_TABLE,
      Key: { credentialID: credentialId },
      UpdateExpression: 'SET #counter = :counter',
      ExpressionAttributeNames: {
        '#counter': 'counter'
      },
      ExpressionAttributeValues: {
        ':counter': counter
      }
    });
    
    await docClient.send(command);
  }

  async deleteAuthenticator(credentialId: string): Promise<void> {
    const command = new DeleteCommand({
      TableName: AUTHENTICATOR_TABLE,
      Key: { credentialID: credentialId }
    });
    
    await docClient.send(command);
  }
}

export default new UserRepository();