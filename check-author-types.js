const mongoose = require('mongoose');

async function checkAuthorIdTypes() {
  try {
    await mongoose.connect('mongodb://localhost:27017/supportai');
    console.log('🔍 Checking Knowledge Base items author_id types...');
    
    const db = mongoose.connection.db;
    const collection = db.collection('knowledgebaseitems');
    
    const items = await collection.find({}).toArray();
    console.log('Total items:', items.length);
    
    if (items.length > 0) {
      console.log('Author ID types and values:');
      items.forEach((item, index) => {
        console.log(`${index + 1}. ${item.title}`);
        console.log(`   Author ID: ${item.author_id}`);
        console.log(`   Author ID type: ${typeof item.author_id}`);
        console.log(`   Is ObjectId: ${item.author_id instanceof mongoose.Types.ObjectId}`);
        console.log('');
      });
      
      // Test the exact query that the API is using
      const searchUserId = '68cd0756672fb0bc43085ae9';
      console.log('\n🔍 Testing exact query with string ID:');
      const stringResult = await collection.find({ author_id: searchUserId }).toArray();
      console.log('Results with string ID:', stringResult.length);
      
      console.log('\n🔍 Testing query with ObjectId:');
      const objectIdResult = await collection.find({ author_id: new mongoose.Types.ObjectId(searchUserId) }).toArray();
      console.log('Results with ObjectId:', objectIdResult.length);
    }
    
    await mongoose.disconnect();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAuthorIdTypes();