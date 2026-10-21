const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const email = (process.env.ADMIN_EMAIL || 'admin@cheapkart.local').toLowerCase();
  const exists = await User.findOne({ $or: [{ email }, { name: username, isAdmin: true }] });
  if (exists) return;
  const password = process.env.ADMIN_PASSWORD || 'admin';
  await User.create({ email, name: username, password: await bcrypt.hash(password, 12), isAdmin: true });
  console.log(`Seeded admin account (${username}); change the default password before deployment.`);
}
module.exports = { seedAdmin };
