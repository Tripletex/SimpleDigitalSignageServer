import { DeleteTableCommand } from '@aws-sdk/client-dynamodb';
import { 
  dynamoDbClient, 
  DEVICE_PING_TABLE, 
  DEVICE_REGISTRATION_TABLE,
  USER_TABLE,
  AUTHENTICATOR_TABLE
} from './dynamoDb';
import { createAllTables } from './createTables';

async function dropTable(tableName: string) {
  try {
    console.log(`Attempting to delete table: ${tableName}`);
    const command = new DeleteTableCommand({
      TableName: tableName
    });
    
    await dynamoDbClient.send(command);
    console.log(`Table ${tableName} deleted successfully`);
  } catch (error) {
    if ((error as any).name === 'ResourceNotFoundException') {
      console.log(`Table ${tableName} does not exist.`);
    } else {
      console.error(`Error deleting table ${tableName}:`, error);
      throw error;
    }
  }
}

async function dropAllTables() {
  try {
    console.log('Dropping all tables...');
    await dropTable(USER_TABLE);
    await dropTable(AUTHENTICATOR_TABLE);
    await dropTable(DEVICE_PING_TABLE);
    await dropTable(DEVICE_REGISTRATION_TABLE);
    console.log('All tables dropped successfully.');
  } catch (error) {
    console.error('Error dropping tables:', error);
  }
}

async function resetDatabase() {
  try {
    console.log('Resetting database...');
    await dropAllTables();
    console.log('Recreating tables...');
    await createAllTables();
    console.log('Database reset completed successfully.');
  } catch (error) {
    console.error('Error resetting database:', error);
  }
}

// Execute if this file is run directly
if (require.main === module) {
  // Set local DynamoDB endpoint if not set
  if (!process.env.DYNAMODB_ENDPOINT) {
    console.log('Setting local DynamoDB endpoint for reset script');
    process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
  }
  
  resetDatabase()
    .then(() => {
      console.log('Database reset process completed.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Error during database reset:', error);
      process.exit(1);
    });
}

export { dropAllTables, resetDatabase };