import { Sequelize } from 'sequelize';
import { DB_CONFIG } from './database';
import dotenv from 'dotenv';

dotenv.config();

// Connect to PostgreSQL without specifying a database
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: DB_CONFIG.host,
  port: DB_CONFIG.port,
  username: DB_CONFIG.username,
  password: DB_CONFIG.password,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
});

// Create database if it doesn't exist
async function createDatabase() {
  try {
    // Check if the database exists
    const [results] = await sequelize.query(
      `SELECT 1 FROM pg_database WHERE datname = '${DB_CONFIG.database}'`
    );
    
    if ((results as any[]).length === 0) {
      console.log(`Creating database '${DB_CONFIG.database}'...`);
      await sequelize.query(`CREATE DATABASE "${DB_CONFIG.database}"`);
      console.log(`Database '${DB_CONFIG.database}' created successfully.`);
    } else {
      console.log(`Database '${DB_CONFIG.database}' already exists.`);
    }
  } catch (error) {
    console.error('Error creating database:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the function
createDatabase();