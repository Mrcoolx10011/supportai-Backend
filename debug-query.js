const mongoose = require('mongoose');
const KnowledgeBaseItem = require('./src/models/KnowledgeBaseItem');

async function debugQuery() {
  try {
    await mongoose.connect('mongodb://localhost:27017/supportai');
    console.log('🔍 Debug: Testing Mongoose vs Raw MongoDB queries...');
    
    const userId = '68cd0756672fb0bc43085ae9';
    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    console.log('User ID string:', userId);
    console.log('User ObjectId:', userObjectId);
    console.log('ObjectId toString():', userObjectId.toString());
    
    // Test 1: Raw MongoDB query with ObjectId
    console.log('\n🔍 Test 1: Raw MongoDB with ObjectId');
    const db = mongoose.connection.db;
    const collection = db.collection('knowledgebaseitems');
    const rawResult1 = await collection.find({ author_id: userObjectId }).toArray();
    console.log('Raw MongoDB with ObjectId:', rawResult1.length, 'items');
    
    // Test 2: Raw MongoDB query with string
    console.log('\n🔍 Test 2: Raw MongoDB with string');
    const rawResult2 = await collection.find({ author_id: userId }).toArray();
    console.log('Raw MongoDB with string:', rawResult2.length, 'items');
    
    // Test 3: Mongoose query with ObjectId
    console.log('\n🔍 Test 3: Mongoose with ObjectId');
    const mongooseResult1 = await KnowledgeBaseItem.find({ author_id: userObjectId });
    console.log('Mongoose with ObjectId:', mongooseResult1.length, 'items');
    
    // Test 4: Mongoose query with string
    console.log('\n🔍 Test 4: Mongoose with string');
    const mongooseResult2 = await KnowledgeBaseItem.find({ author_id: userId });
    console.log('Mongoose with string:', mongooseResult2.length, 'items');
    
    // Test 5: Check what's actually in the database
    console.log('\n🔍 Test 5: Check actual database content');
    const allItems = await collection.find({}).toArray();
    console.log('Total items in DB:', allItems.length);
    if (allItems.length > 0) {
      console.log('First item author_id:', allItems[0].author_id);
      console.log('First item author_id type:', typeof allItems[0].author_id);
      console.log('First item author_id constructor:', allItems[0].author_id.constructor.name);
      console.log('Does it equal our ObjectId?', allItems[0].author_id.equals(userObjectId));
      console.log('Does toString() match?', allItems[0].author_id.toString() === userId);
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Debug complete!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugQuery();