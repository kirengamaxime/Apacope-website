require('dotenv').config();
const mongoose = require('mongoose');

const clearL5Data = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB...');

    const db = mongoose.connection.db;
    const classesCollection = db.collection('classes');
    const attendancesCollection = db.collection('attendances');
    const assignmentsCollection = db.collection('assignments');

    // 1. Find the L5 SWD class ID
    const targetClass = await classesCollection.findOne({ name: 'L5 SWD' });

    if (!targetClass) {
      console.log('❌ Could not find class named "L5 SWD".');
      process.exit(1);
    }

    const classId = targetClass._id;
    console.log(`Found "L5 SWD" with ID: ${classId}`);

    // 2. Delete Attendance Records
    const attResult = await attendancesCollection.deleteMany({ class: classId });
    console.log(`🗑️ Deleted ${attResult.deletedCount} attendance records.`);

    // 3. Delete Assignment Records
    // Note: If your assignments are linked by module instead of class, we may need to adjust this.
    const assResult = await assignmentsCollection.deleteMany({ class: classId });
    console.log(`🗑️ Deleted ${assResult.deletedCount} assignment records.`);

    console.log('✅ All done!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
};

clearL5Data();