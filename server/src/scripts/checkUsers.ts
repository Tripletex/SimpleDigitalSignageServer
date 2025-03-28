// Script to check for users in the database
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, USER_TABLE } from '../config/dynamoDb';

// Set local DynamoDB endpoint if not set
if (!process.env.DYNAMODB_ENDPOINT) {
  console.log('Setting local DynamoDB endpoint for check script');
  process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
}

async function listUsers() {
  try {
    console.log(`Scanning ${USER_TABLE} table for users...`);
    const command = new ScanCommand({
      TableName: USER_TABLE
    });
    
    const response = await docClient.send(command);
    const items = response.Items || [];
    
    console.log(`Found ${items.length} users in ${USER_TABLE}`);
    
    // Print each user
    if (items.length > 0) {
      console.log('\nUser details:');
      items.forEach((item, index) => {
        console.log(`\nUser ${index + 1}:`);
        console.log(JSON.stringify(item, null, 2));
      });
    }
    
    return items;
  } catch (error) {
    console.error('Error listing users:', error);
    return [];
  }
}

// Run the script
listUsers()
  .then(() => {
    console.log('\nUser check complete.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error during user check:', error);
    process.exit(1);
  });