const mongoose = require('mongoose');
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  orderItems: [{ productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, name: { type: String, required: true }, price: { type: Number, required: true }, quantity: { type: Number, required: true }, seller: { type: String } }],
  totalAmount: { type: Number, required: true, min: 0 },
  shippingAddress: { street: String, city: String, pincode: String, phone: String },
  status: { type: String, enum: ['placed', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'placed', index: true },
}, { timestamps: true, collection: 'orders' });
module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema, 'orders');
