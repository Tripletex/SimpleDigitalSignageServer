import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Function to detect if we're running in local development
function isLocalDevelopment(): boolean {
  return process.env.DYNAMODB_ENDPOINT !== undefined;
}

// Configure DynamoDB client
let clientConfig: any = {
  region: process.env.AWS_REGION || 'us-east-1',
};

// For local development
if (isLocalDevelopment()) {
  console.log(`Using local DynamoDB at ${process.env.DYNAMODB_ENDPOINT}`);
  clientConfig = {
    ...clientConfig,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: {
      accessKeyId: 'fakeAccessKeyId',
      secretAccessKey: 'fakeSecretAccessKey'
    },
    // Force path style access for local DynamoDB
    forcePathStyle: true
  };
}

const dynamoDbClient = new DynamoDBClient(clientConfig);

// Create document client for simplified operations
const docClient = DynamoDBDocumentClient.from(dynamoDbClient, {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true
  }
});

// Constants for DynamoDB
export const DEVICE_PING_TABLE = 'DevicePings';
export const DEVICE_REGISTRATION_TABLE = 'DeviceRegistrations';
export const USER_TABLE = 'Users';
export const AUTHENTICATOR_TABLE = 'Authenticators';

export { dynamoDbClient, docClient, isLocalDevelopment };