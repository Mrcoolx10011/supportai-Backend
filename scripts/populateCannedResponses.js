const mongoose = require('mongoose');
const Client = require('../src/models/Client');
const CannedResponse = require('../src/models/CannedResponse');

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

const populateCannedResponses = async () => {
  try {
    // Get the first client to assign responses to
    const client = await Client.findOne({ name: 'Demo Client' });
    if (!client) {
      console.log('No client found. Please run populateClients.js first');
      return;
    }

    // Clear existing canned responses
    await CannedResponse.deleteMany({});
    console.log('Cleared existing canned responses');

    // Sample canned responses
    const sampleResponses = [
      {
        client_id: client._id,
        title: "Welcome Greeting",
        shortcut: "/hello",
        content: "Hello! Welcome to our support chat. How can I assist you today?",
        category: "Greetings",
        is_active: true,
        usage_count: 0
      },
      {
        client_id: client._id,
        title: "Thank You",
        shortcut: "/thanks",
        content: "Thank you for contacting us! Is there anything else I can help you with?",
        category: "Greetings",
        is_active: true,
        usage_count: 0
      },
      {
        client_id: client._id,
        title: "Technical Support",
        shortcut: "/tech",
        content: "I understand you're experiencing a technical issue. Let me help you troubleshoot this step by step.",
        category: "Technical",
        is_active: true,
        usage_count: 0
      },
      {
        client_id: client._id,
        title: "Billing Inquiry",
        shortcut: "/billing",
        content: "I can help you with your billing question. Let me pull up your account information.",
        category: "Billing",
        is_active: true,
        usage_count: 0
      },
      {
        client_id: client._id,
        title: "Escalate to Agent",
        shortcut: "/escalate",
        content: "I'm connecting you with one of our human agents who can provide more specialized assistance.",
        category: "Escalation",
        is_active: true,
        usage_count: 0
      },
      {
        client_id: client._id,
        title: "Office Hours",
        shortcut: "/hours",
        content: "Our support hours are Monday-Friday 9AM-6PM EST. For urgent issues outside these hours, please email support@company.com",
        category: "Information",
        is_active: true,
        usage_count: 0
      }
    ];

    // Insert sample responses
    const responses = await CannedResponse.insertMany(sampleResponses);
    console.log(`Added ${responses.length} sample canned responses:`);
    responses.forEach(response => {
      console.log(`- ${response.title} (${response.shortcut})`);
    });

  } catch (error) {
    console.error('Error populating canned responses:', error);
  }
};

const main = async () => {
  await connectDB();
  await populateCannedResponses();
  mongoose.connection.close();
  console.log('Database connection closed');
};

main();