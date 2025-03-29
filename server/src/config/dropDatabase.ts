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

// Drop database if it exists
async function dropDatabase() {
  try {
    // Check if the database exists
    const [results] = await sequelize.query(
      `SELECT 1 FROM pg_database WHERE datname = '${DB_CONFIG.database}'`
    );
    
    if ((results as any[]).length > 0) {
      console.log(`Dropping database '${DB_CONFIG.database}'...`);
      
      // Terminate all connections to the database before dropping
      await sequelize.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = '${DB_CONFIG.database}'
        AND pid <> pg_backend_pid();
      `);
      
      await sequelize.query(`DROP DATABASE IF EXISTS "${DB_CONFIG.database}"`);
      console.log(`Database '${DB_CONFIG.database}' dropped successfully.`);
    } else {
      console.log(`Database '${DB_CONFIG.database}' does not exist.`);
    }
  } catch (error) {
    console.error('Error dropping database:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the function
dropDatabase();