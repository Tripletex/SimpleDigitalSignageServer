import { Sequelize } from 'sequelize-typescript';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'signage',
  password: process.env.DB_PASSWORD || 'signage',
  database: process.env.DB_NAME || 'signage',
};

// Import model initialization function
import { initModels } from '../models';

// Create Sequelize instance
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: dbConfig.host,
  port: dbConfig.port,
  username: dbConfig.username,
  password: dbConfig.password,
  database: dbConfig.database,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
});

// Initialize models with the sequelize instance
initModels(sequelize);

// Export constants and utility functions
export const DB_CONFIG = dbConfig;
export const DB_SCHEMA = 'public';

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    return true;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    return false;
  }
};

export default sequelize;