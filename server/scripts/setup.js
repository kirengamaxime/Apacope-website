/* First-time setup: creates the role list and default attendance thresholds. Safe to re-run; deletes nothing. */
require('dotenv').config();
const mongoose = require('mongoose');
const M = require('../models');
const { DEFAULT_THRESHOLDS } = require('../utils/helpers');

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/apacope');
  for (const name of M.ROLES) await M.Role.updateOne({ name }, { $setOnInsert: { name, label: name, permissions: [] } }, { upsert: true });
  if (!(await M.AttendanceRule.countDocuments())) await M.AttendanceRule.create({ thresholds: DEFAULT_THRESHOLDS });
  console.log('Setup done. Next: npm run create-admin');
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
