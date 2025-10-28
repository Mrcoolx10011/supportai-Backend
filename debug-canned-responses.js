const mongoose = require('mongoose');

async function debugCannedResponses() {
  try {
    const atlasUri = 'mongodb+srv://mrcoolx:root%40123@cluster0.ubpz2.mongodb.net/supportai?retryWrites=true&w=majority&appName=Cluster0';
    await mongoose.connect(atlasUri);
    
    console.log('🔍 Debugging Canned Responses data...\n');
    
    // Check users
    const users = await mongoose.connection.db.collection('users').find({}).toArray();
    console.log('👥 Users in database:');
    users.forEach(user => {
      console.log(`  - ${user.email}: ${user._id}`);
    });
    
    // Check canned responses
    const cannedResponses = await mongoose.connection.db.collection('cannedresponses').find({}).toArray();
    console.log(`\n💬 Found ${cannedResponses.length} canned responses:`);
    
    if (cannedResponses.length > 0) {
      console.log('📋 Author IDs in canned responses:');
      const authorIds = [...new Set(cannedResponses.map(cr => cr.author_id?.toString()))];
      authorIds.forEach(authorId => {
        const count = cannedResponses.filter(cr => cr.author_id?.toString() === authorId).length;
        console.log(`  - ${authorId}: ${count} responses`);
      });
      
      console.log('\n📝 Sample canned response:');
      console.log(JSON.stringify(cannedResponses[0], null, 2));
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugCannedResponses();