const mongoose = require('mongoose');
const Client = require('../src/models/Client');

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

// Sample client data
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

const populateClients = async () => {
  try {
    // Clear existing clients
    await Client.deleteMany({});
    console.log('Cleared existing clients');

    // Insert sample clients
    const clients = await Client.insertMany(sampleClients);
    console.log(`Added ${clients.length} sample clients:`);
    clients.forEach(client => {
      console.log(`- ${client.name} (${client.email})`);
    });

  } catch (error) {
    console.error('Error populating clients:', error);
  }
};

const main = async () => {
  await connectDB();
  await populateClients();
  mongoose.connection.close();
  console.log('Database connection closed');
};

main();