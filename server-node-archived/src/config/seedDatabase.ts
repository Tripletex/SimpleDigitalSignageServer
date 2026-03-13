import sequelize from './database';
import { User } from '../models/User';
import { generateUUID } from '../utils/helpers';
import { UserRole } from '../../../shared/src/userData';

// Function to seed the database with initial data
async function seedDatabase() {
  try {
    console.log('Starting database seeding...');
    
    // Check if any users exist
    const userCount = await User.count();
    
    if (userCount === 0) {
      console.log('Creating initial admin user...');
      
      // Create admin user
      await User.create({
        id: generateUUID(),
        email: 'admin@example.com',
        displayName: 'Administrator',
        role: UserRole.ADMIN,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log('Initial admin user created successfully.');
    } else {
      console.log('Users already exist, skipping admin user creation.');
    }
    
    console.log('Database seeding completed successfully.');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the function
seedDatabase();