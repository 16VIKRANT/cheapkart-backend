const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { publish } = require('../services/solace');

async function allOrders(req, res, next) {
  try {
    const orders = await Order.find().populate('userId', 'name email').sort({ createdAt: -1 }).lean();
    res.json({ orders, count: orders.length });
  } catch (err) { next(err); }
}
async function inventory(req, res, next) {
  try {
    const products = await Product.find().sort({ name: 1 }).lean();
    res.json({ products, count: products.length });
  } catch (err) { next(err); }
}
async function updateStock(req, res, next) {
  try {
    const { stock } = req.body;
    if (!Number.isInteger(Number(stock)) || Number(stock) < 0) return res.status(400).json({ message: 'stock must be a non-negative integer' });
    const id = req.params.id;
    const product = await Product.findOneAndUpdate({ $or: [{ productId: id }, ...(mongoose.isValidObjectId(id) ? [{ _id: id }] : [])] }, { $set: { stock: Number(stock) } }, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const topic = process.env.SOLACE_INVENTORY_TOPIC || 'ecommerce/inventory/updated';
    let eventPublished = true;
    try { await publish(topic, { eventType: 'INVENTORY_UPDATED', productId: product.productId || product._id.toString(), name: product.name, stock: product.stock, updatedBy: req.user._id.toString(), updatedAt: new Date().toISOString() }); }
    catch (err) { eventPublished = false; console.error('Stock updated, but Solace publish failed:', err.message); }
    res.json({ product, eventPublished });
  } catch (err) { next(err); }
}
async function updateOrderStatus(req, res, next) {
  try {
    const allowed = ['placed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!allowed.includes(req.body.status)) return res.status(400).json({ message: `status must be one of: ${allowed.join(', ')}` });
    const order = await Order.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true, runValidators: true });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json({ order });
  } catch (err) { next(err); }
}
module.exports = { allOrders, inventory, updateStock, updateOrderStatus };
