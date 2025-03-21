import express from 'express';
import deviceRoutes from './routes/deviceRoutes';
import path from 'path';
import { createAllTables } from './config/createTables';

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());
app.use('/api/device', deviceRoutes);

const clientPath = process.env.CLIENT_PATH || '../../client/build';
app.use(express.static(path.join(__dirname, clientPath)));

// Initialize DynamoDB tables before starting the server
async function initializeDatabase() {
  try {
    await createAllTables();
    console.log('Database initialization completed');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

// Start the server
async function startServer() {
  await initializeDatabase();
  
  app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    if (process.env.DYNAMODB_ENDPOINT) {
      console.log(`Using local DynamoDB at ${process.env.DYNAMODB_ENDPOINT}`);
    } else {
      console.log(`Using AWS DynamoDB in region ${process.env.AWS_REGION || 'us-east-1'}`);
    }
  });
}

startServer();

process.on('SIGINT', function() {
  console.log("Caught interrupt signal");
  process.exit();
});