import sequelize from './database';
import '../models'; // Import all models to register them

// Function to create/migrate tables
async function migrateDatabase() {
  try {
    console.log('Starting database migration...');
    // This will create tables based on the models
    await sequelize.sync({ alter: true });
    console.log('Database migration completed successfully.');
  } catch (error) {
    console.error('Error migrating database:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the function
migrateDatabase();