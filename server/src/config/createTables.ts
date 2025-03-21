import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { dynamoDbClient, DEVICE_PING_TABLE, DEVICE_REGISTRATION_TABLE } from './dynamoDb';

async function createDevicePingTable() {
  try {
    const command = new CreateTableCommand({
      TableName: DEVICE_PING_TABLE,
      AttributeDefinitions: [
        {
          AttributeName: 'id',
          AttributeType: 'S'
        }
      ],
      KeySchema: [
        {
          AttributeName: 'id',
          KeyType: 'HASH'
        }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    });

    const response = await dynamoDbClient.send(command);
    console.log(`Table ${DEVICE_PING_TABLE} created successfully`);
    return response;
  } catch (error) {
    if ((error as any).name === 'ResourceInUseException') {
      console.log(`Table ${DEVICE_PING_TABLE} already exists.`);
    } else {
      console.error(`Error creating table ${DEVICE_PING_TABLE}:`, error);
      throw error;
    }
  }
}

async function createRegistrationTable() {
  try {
    const command = new CreateTableCommand({
      TableName: DEVICE_REGISTRATION_TABLE,
      AttributeDefinitions: [
        {
          AttributeName: 'id',
          AttributeType: 'S'
        }
      ],
      KeySchema: [
        {
          AttributeName: 'id',
          KeyType: 'HASH'
        }
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    });

    const response = await dynamoDbClient.send(command);
    console.log(`Table ${DEVICE_REGISTRATION_TABLE} created successfully`);
    return response;
  } catch (error) {
    if ((error as any).name === 'ResourceInUseException') {
      console.log(`Table ${DEVICE_REGISTRATION_TABLE} already exists.`);
    } else {
      console.error(`Error creating table ${DEVICE_REGISTRATION_TABLE}:`, error);
      throw error;
    }
  }
}

async function createAllTables() {
  await createDevicePingTable();
  await createRegistrationTable();
}

// Execute if this file is run directly
if (require.main === module) {
  createAllTables()
    .then(() => console.log('Table creation process completed.'))
    .catch(console.error);
}

export { createDevicePingTable, createRegistrationTable, createAllTables };