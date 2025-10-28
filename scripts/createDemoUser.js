const mongoose = require('mongoose');
const User = require('../src/models/User');
require('dotenv').config();

async function createDemoUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if demo user already exists
    const existingUser = await User.findOne({ email: 'admin@example.com' });
    if (existingUser) {
      console.log('Demo user already exists');
      return;
    }

    // Create demo user
    const demoUser = new User({
      full_name: 'Demo Admin',
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin',
      ai_api_key: null
    });

    await demoUser.save();
    console.log('Demo user created successfully');
    console.log('Email: admin@example.com');
    console.log('Password: password123');

  } catch (error) {
    console.error('Error creating demo user:', error);
  } finally {
    await mongoose.disconnect();
  }
}

createDemoUser();