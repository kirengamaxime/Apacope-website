require('dotenv').config();
const readline = require('readline');
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/apacope');
  const db = mongoose.connection.name;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question(`This permanently deletes ALL data in database "${db}".\nType the database name to confirm: `, r));
  rl.close();
  if (answer.trim() !== db) { console.log('Cancelled. Nothing was deleted.'); return mongoose.disconnect(); }
  await mongoose.connection.dropDatabase();
  console.log('Database emptied.');
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });