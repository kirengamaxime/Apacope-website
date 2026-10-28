require('dotenv').config();
const mongoose = require('mongoose');

const clearL5SWDMarks = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB...');

    // 1. Access the collections directly
    const db = mongoose.connection.db;
    const classesCollection = db.collection('classes'); // Check if your collection is named 'classes'
    const assessmentsCollection = db.collection('assessments');

    // 2. Find the specific L5 SWD class
    // Adjust 'level' and 'trade' if your database uses different field names (e.g., 'className')
      // 2. Find the specific L5 SWD class by its exact name
    const targetClass = await classesCollection.findOne({ 
      name: 'L5 SWD' 
    });

    if (!targetClass) {
      console.log('❌ Could not find a class matching Level: L5 and Trade: SWD.');
      // Let's print all classes so you can see how they are named
      const allClasses = await classesCollection.find({}).toArray();
      console.log("Here are the classes in your DB:", allClasses);
      process.exit(1);
    }

    console.log(`Found Class ID: ${targetClass._id}`);

    // 3. Delete the assessments
    const result = await assessmentsCollection.deleteMany({ 
      class: targetClass._id 
    });

    console.log(`🗑️ SUCCESS: Deleted ${result.deletedCount} assessment records for L5 SWD.`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

clearL5SWDMarks();