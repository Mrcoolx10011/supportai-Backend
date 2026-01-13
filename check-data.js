/**
 * Check if knowledge base and canned responses exist
 */

const mongoose = require('mongoose');
require('dotenv').config();

const KnowledgeBaseItem = require('./src/models/KnowledgeBaseItem');
const CannedResponse = require('./src/models/CannedResponse');
const Client = require('./src/models/Client');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/supportai';

async function checkData() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB\n');

    // Check clients
    const clients = await Client.find().limit(5);
    console.log(`📊 Total Clients: ${clients.length}`);
    if (clients.length > 0) {
      console.log(`First client ID: ${clients[0]._id}`);
      console.log(`First client name: ${clients[0].name}\n`);
    }

    // Check knowledge base
    const kbItems = await KnowledgeBaseItem.find();
    console.log(`📚 Total Knowledge Base Items: ${kbItems.length}`);
    if (kbItems.length === 0) {
      console.log('❌ No knowledge base items found!');
    } else {
      kbItems.slice(0, 3).forEach(item => {
        console.log(`  - ${item.title} (category: ${item.category})`);
      });
    }

    console.log('');

    // Check canned responses
    const cannedResponses = await CannedResponse.find();
    console.log(`💬 Total Canned Responses: ${cannedResponses.length}`);
    if (cannedResponses.length === 0) {
      console.log('❌ No canned responses found!');
    } else {
      cannedResponses.slice(0, 3).forEach(resp => {
        console.log(`  - ${resp.title} (shortcut: ${resp.shortcut})`);
      });
    }

    console.log('\n━'.repeat(80));
    
    if (kbItems.length === 0 && cannedResponses.length === 0) {
      console.log('\n⚠️  DATABASE IS EMPTY!');
      console.log('Next step: Run the populate scripts to add sample data\n');
      console.log('Options:');
      console.log('1. Run: node server/scripts/populateDatabase.js');
      console.log('2. Manually add items via the UI\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkData();
