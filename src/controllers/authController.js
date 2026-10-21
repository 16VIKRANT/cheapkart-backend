const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function tokenFor(user) {
  return jwt.sign({ sub: user._id.toString(), isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}
function publicUser(user) {
  return { id: user._id, email: user.email, name: user.name, address: user.address, isAdmin: user.isAdmin };
}
async function signup(req, res, next) {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ message: 'name, email, and password are required' });
    if (String(password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: 'A user with this email already exists. Please sign in instead.' });
    let user;
    try {
      user = await User.create({ email: normalizedEmail, name: String(name).trim(), password: await bcrypt.hash(password, 12) });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ message: 'A user with this email already exists. Please sign in instead.' });
      throw err;
    }
    res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
  } catch (err) { next(err); }
}
async function login(req, res, next) {
  try {
    const { email, username, password } = req.body;
    if (!password || (!email && !username)) return res.status(400).json({ message: 'email or username and password are required' });
    let user;
    if (username) {
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      if (username !== adminUsername) return res.status(401).json({ message: 'Invalid credentials' });
      user = await User.findOne({ name: adminUsername, isAdmin: true }).select('+password');
    } else user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+password');
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Invalid credentials' });
    res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch (err) { next(err); }
}
async function getProfile(req, res) { res.json({ user: publicUser(req.user) }); }
async function updateProfile(req, res, next) {
  try {
    const { name, address } = req.body;
    if (name !== undefined) req.user.name = String(name).trim();
    if (address !== undefined) {
      if (!address || typeof address !== 'object' || Array.isArray(address)) return res.status(400).json({ message: 'address must be an object' });
      for (const key of ['street', 'city', 'pincode', 'phone']) if (address[key] !== undefined) req.user.address[key] = String(address[key]).trim();
    }
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  } catch (err) { next(err); }
}
module.exports = { signup, login, getProfile, updateProfile };
