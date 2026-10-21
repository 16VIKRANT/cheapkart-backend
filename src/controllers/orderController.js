const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { publish } = require('../services/solace');

async function checkout(req, res, next) {
  const session = await mongoose.startSession();
  let createdOrder;
  let event;
  try {
    await session.withTransaction(async () => {
      const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId').session(session);
      if (!cart || cart.items.length === 0) { const err = new Error('Your cart is empty'); err.status = 400; throw err; }
      const shippingAddress = req.body.shippingAddress || req.user.address?.toObject?.() || req.user.address;
      if (!shippingAddress?.street || !shippingAddress?.city || !shippingAddress?.pincode || !shippingAddress?.phone) {
        const err = new Error('Complete your shipping address in profile or provide shippingAddress at checkout'); err.status = 400; throw err;
      }
      const orderItems = [];
      const eventItems = [];
      let totalAmount = 0;
      for (const cartItem of cart.items) {
        const product = cartItem.productId;
        if (!product) { const err = new Error('A product in your cart no longer exists'); err.status = 409; throw err; }
        const quantity = cartItem.quantity;
        const updated = await Product.findOneAndUpdate({ _id: product._id, stock: { $gte: quantity } }, { $inc: { stock: -quantity } }, { new: true, session });
        if (!updated) { const err = new Error(`Insufficient stock for ${product.name}`); err.status = 409; throw err; }
        const subtotal = product.price * quantity;
        totalAmount += subtotal;
        orderItems.push({ productId: product._id, name: product.name, price: product.price, quantity, seller: product.seller?.name });
        eventItems.push({ productId: product.productId || product._id.toString(), name: product.name, price: product.price, quantity, seller: product.seller?.name, sellerEmail: product.seller?.email, stockAfter: updated.stock });
      }
      [createdOrder] = await Order.create([{
        userId: req.user._id, orderItems, totalAmount: Math.round(totalAmount * 100) / 100, shippingAddress,
      }], { session });
      await Cart.updateOne({ _id: cart._id }, { $set: { items: [] } }, { session });
      event = {
        eventType: 'ORDER_PLACED', orderId: createdOrder._id.toString(), customer: { name: req.user.name, email: req.user.email },
        items: eventItems, totalAmount: createdOrder.totalAmount, shippingAddress, createdAt: createdOrder.createdAt,
      };
    });
    const topic = process.env.SOLACE_ORDERS_TOPIC || 'ecommerce/orders/placed';
    let eventPublished = true;
    try { await publish(topic, event); }
    catch (err) { eventPublished = false; console.error('Order saved, but Solace publish failed:', err.message); }
    res.status(201).json({ order: createdOrder, eventPublished, message: eventPublished ? 'Order placed' : 'Order placed; notification event could not be delivered' });
  } catch (err) { next(err); }
  finally { await session.endSession(); }
}

async function myOrders(req, res, next) {
  try {
    const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json({ orders });
  } catch (err) { next(err); }
}
module.exports = { checkout, myOrders };
