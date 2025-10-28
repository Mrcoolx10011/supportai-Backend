const mongoose = require('mongoose');
const Client = require('../src/models/Client');
const CannedResponse = require('../src/models/CannedResponse');
const User = require('../src/models/User');

// MongoDB connection
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

const populateAllData = async () => {
  try {
    // Create a demo user first
    await User.deleteMany({});
    console.log('Cleared existing users');

    const demoUser = new User({
      full_name: 'Demo User',
      email: 'demo@supportai.com',
      password: 'password123', // Will be hashed by the pre-save hook
      role: 'admin',
      status: 'active'
    });
    await demoUser.save();
    console.log('Created demo user: demo@supportai.com (password: password123)');

    // Create clients
    await Client.deleteMany({});
    console.log('Cleared existing clients');

    const sampleClients = [
      {
        name: "Google",
        email: "contact@google.com",
        company: "Google",
        phone: "+1-650-253-0000",
        status: "active"
      },
      {
        name: "Microsoft",
        email: "contact@microsoft.com", 
        company: "Microsoft Corporation",
        phone: "+1-425-882-8080",
        status: "active"
      },
      {
        name: "Apple",
        email: "contact@apple.com",
        company: "Apple Inc.",
        phone: "+1-408-996-1010", 
        status: "active"
      },
      {
        name: "Demo Client",
        email: "demo@example.com",
        company: "Demo Company",
        phone: "+1-555-0123",
        status: "active"
      }
    ];

    const clients = await Client.insertMany(sampleClients);
    console.log(`Added ${clients.length} sample clients`);

    // Create canned responses
    await CannedResponse.deleteMany({});
    console.log('Cleared existing canned responses');

    const sampleResponses = [
      {
        title: "Welcome Greeting",
        shortcut: "/hello",
        content: "Hello! Welcome to our support chat. How can I assist you today?",
        category: "Greetings",
        author_id: demoUser._id,
        is_active: true,
        usage_count: 0
      },
      {
        title: "Thank You",
        shortcut: "/thanks",
        content: "Thank you for contacting us! Is there anything else I can help you with?",
        category: "Greetings",
        author_id: demoUser._id,
        is_active: true,
        usage_count: 0
      },
      {
        title: "Technical Support",
        shortcut: "/tech",
        content: "I understand you're experiencing a technical issue. Let me help you troubleshoot this step by step.",
        category: "Technical",
        author_id: demoUser._id,
        is_active: true,
        usage_count: 0
      },
      {
        title: "Billing Inquiry",
        shortcut: "/billing",
        content: "I can help you with your billing question. Let me pull up your account information.",
        category: "Billing",
        author_id: demoUser._id,
        is_active: true,
        usage_count: 0
      },
      {
        title: "Escalate to Agent",
        shortcut: "/escalate",
        content: "I'm connecting you with one of our human agents who can provide more specialized assistance.",
        category: "Escalation",
        author_id: demoUser._id,
        is_active: true,
        usage_count: 0
      },
      {
        title: "Office Hours",
        shortcut: "/hours",
        content: "Our support hours are Monday-Friday 9AM-6PM EST. For urgent issues outside these hours, please email support@company.com",
        category: "Information",
        author_id: demoUser._id,
        is_active: true,
        usage_count: 0
      }
    ];

    const responses = await CannedResponse.insertMany(sampleResponses);
    console.log(`Added ${responses.length} sample canned responses`);

    console.log('\n✅ Database populated successfully!');
    console.log('You can now:');
    console.log('1. Login with: demo@supportai.com / password123');
    console.log('2. Create new clients');
    console.log('3. Use canned responses in chat');

  } catch (error) {
    console.error('Error populating database:', error);
  }
};

const main = async () => {
  await connectDB();
  await populateAllData();
  mongoose.connection.close();
  console.log('Database connection closed');
};

main();