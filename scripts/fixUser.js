const mongoose = require('mongoose');
const User = require('../src/models/User');

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/supportai', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const checkAndFixUser = async () => {
  try {
    // Check if user exists
    let user = await User.findOne({ email: 'demo@supportai.com' });
    
    if (user) {
      console.log('Existing user found:', user.email);
      // Delete and recreate to ensure proper password hashing
      await User.deleteOne({ email: 'demo@supportai.com' });
      console.log('Deleted existing user');
    }

    // Create new user with plain password (will be hashed by pre-save hook)
    const newUser = new User({
      full_name: 'Demo User',
      email: 'demo@supportai.com',
      password: 'password123',
      role: 'admin',
      status: 'active'
    });

    await newUser.save();
    console.log('✅ Created new user successfully');
    
    // Test password comparison
    const isValid = await newUser.comparePassword('password123');
    console.log('Password test result:', isValid ? '✅ VALID' : '❌ INVALID');
    
  } catch (error) {
    console.error('Error:', error);
  }
};

const main = async () => {
  await connectDB();
  await checkAndFixUser();
  mongoose.connection.close();
  console.log('Database connection closed');
};

main();