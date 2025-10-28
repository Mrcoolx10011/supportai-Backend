const mongoose = require('mongoose');

async function checkDatabases() {
  try {
    console.log('🔧 Checking and copying data between databases...');
    
    // First connect to supportai and get data
    await mongoose.connect('mongodb://localhost:27017/supportai');
    console.log('✅ Connected to supportai database');
    
    const supportaiItems = await mongoose.connection.db.collection('knowledgebaseitems').find({}).toArray();
    const supportaiUsers = await mongoose.connection.db.collection('users').find({}).toArray();
    
    console.log(`📊 Items in supportai database: ${supportaiItems.length}`);
    console.log(`📊 Users in supportai database: ${supportaiUsers.length}`);
    
    await mongoose.disconnect();
    
    // Now connect to test database
    await mongoose.connect('mongodb://localhost:27017/test');
    console.log('✅ Connected to test database');
    
    const testItems = await mongoose.connection.db.collection('knowledgebaseitems').find({}).toArray();
    const testUsers = await mongoose.connection.db.collection('users').find({}).toArray();
    
    console.log(`📊 Items in test database: ${testItems.length}`);
    console.log(`📊 Users in test database: ${testUsers.length}`);
    
    // Copy data if needed
    if (supportaiItems.length > 0 && testItems.length === 0) {
      console.log('🔧 Copying knowledge base items...');
      await mongoose.connection.db.collection('knowledgebaseitems').insertMany(supportaiItems);
      console.log(`✅ Copied ${supportaiItems.length} knowledge base items`);
    }
    
    if (supportaiUsers.length > 0 && testUsers.length === 0) {
      console.log('🔧 Copying users...');
      await mongoose.connection.db.collection('users').insertMany(supportaiUsers);
      console.log(`✅ Copied ${supportaiUsers.length} users`);
    }
    
    // Verify
    const finalTestItems = await mongoose.connection.db.collection('knowledgebaseitems').find({}).toArray();
    console.log(`📊 Final items in test database: ${finalTestItems.length}`);
    
    if (finalTestItems.length > 0) {
      console.log('📝 Sample item:');
      console.log('- Title:', finalTestItems[0].title);
      console.log('- Author ID:', finalTestItems[0].author_id);
    }
    
    await mongoose.disconnect();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkDatabases();