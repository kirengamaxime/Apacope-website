/*
 * Creates the first System Administrator (or resets that account's password with --reset).
 *   npm run create-admin
 *   npm run create-admin -- --reset
 * Non-interactive: ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD environment variables.
 * No password is stored in the code; the administrator then creates every other account in the app.
 */
require('dotenv').config();
const readline = require('readline');
const mongoose = require('mongoose');
const { User } = require('../models');

const reset = process.argv.includes('--reset');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
const ask = (q, hidden) => new Promise((resolve) => {
  if (hidden) {
    const out = rl.output;
    rl._writeToOutput = (s) => { if (s.includes(q)) out.write(s); else if (s.includes('\n') || s.includes('\r')) out.write('\n'); };
  }
  rl.question(q, (a) => { rl._writeToOutput = (s) => rl.output.write(s); resolve(a.trim()); });
});

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/apacope');
  const email = (process.env.ADMIN_EMAIL || await ask('Administrator email: ')).toLowerCase();
  let user = await User.findOne({ email }).select('+password');
  if (user && !reset) throw new Error('That email already exists. Use --reset to set a new password.');
  if (reset && (!user || user.role !== 'admin')) throw new Error('No System Administrator with that email.');
  const name = user ? user.name : (process.env.ADMIN_NAME || await ask('Full name: '));
  const password = process.env.ADMIN_PASSWORD || await ask('Password (min 10 characters): ', true);
  if (password.length < 10) throw new Error('Password must be at least 10 characters.');
  if (user) { user.password = password; user.active = true; user.mustChangePassword = false; }
  else user = new User({ name, email, password, role: 'admin' });
  await user.save();
  console.log(`\n${reset ? 'Password reset for' : 'System Administrator created:'} ${email}`);
  rl.close();
  await mongoose.disconnect();
})().catch((e) => { console.error('\n' + e.message); process.exit(1); });
