const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  street: { type: String, trim: true, default: '' },
  city: { type: String, trim: true, default: '' },
  pincode: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
}, { _id: false });

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  name: { type: String, trim: true, required: true },
  address: { type: addressSchema, default: () => ({}) },
  isAdmin: { type: Boolean, default: false },
}, { timestamps: true, collection: 'users' });

module.exports = mongoose.models.User || mongoose.model('User', userSchema, 'users');
