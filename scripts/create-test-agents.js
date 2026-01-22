const mongoose = require('mongoose');
const User = require('../src/models/User');
require('dotenv').config();

const testAgents = [
  {
    full_name: 'John Smith',
    email: 'john@supportai.com',
    role: 'agent',
    department: 'Support',
    phone: '+1-555-0001',
    status: 'active',
    password: 'Agent@123' // Will be hashed
  },
  {
    full_name: 'Sarah Johnson',
    email: 'sarah@supportai.com',
    role: 'agent',
    department: 'Support',
    phone: '+1-555-0002',
    status: 'active',
    password: 'Agent@123'
  },
  {
    full_name: 'Mike Davis',
    email: 'mike@supportai.com',
    role: 'agent',
    department: 'Support',
    phone: '+1-555-0003',
    status: 'active',
    password: 'Agent@123'
  },
  {
    full_name: 'Emily Wilson',
    email: 'emily@supportai.com',
    role: 'agent',
    department: 'Support',
    phone: '+1-555-0004',
    status: 'active',
    password: 'Agent@123'
  },
  {
    full_name: 'David Brown',
    email: 'david@supportai.com',
    role: 'agent',
    department: 'Support',
    phone: '+1-555-0005',
    status: 'active',
    password: 'Agent@123'
  }
];

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/supportai', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('✅ Connected to MongoDB');
  
  try {
    // Create agents
    const createdAgents = await User.insertMany(testAgents);
    console.log(`✅ Created ${createdAgents.length} test agents:`);
    
    createdAgents.forEach(agent => {
      console.log(`  - ${agent.full_name} (${agent.email})`);
    });
    
    await mongoose.connection.close();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error creating agents:', error.message);
    process.exit(1);
  }
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});
