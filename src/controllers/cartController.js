const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

async function getCart(req, res, next) {
  try {
    const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
    res.json({ cart: cart || { userId: req.user._id, items: [] } });
  } catch (err) { next(err); }
}
async function updateCart(req, res, next) {
  try {
    const { productId, quantity, items } = req.body;
    let updates;
    const replaceAll = Array.isArray(items);
    if (replaceAll) updates = items;
    else if (productId && Number.isInteger(Number(quantity))) updates = [{ productId, quantity: Number(quantity) }];
    else return res.status(400).json({ message: 'Provide productId and integer quantity, or an items array' });
    const existingCart = replaceAll ? null : await Cart.findOne({ userId: req.user._id });
    const normalized = new Map((existingCart?.items || []).map((line) => [line.productId.toString(), line.quantity]));
    for (const item of updates) {
      const key = String(item.productId || '');
      if (!key || (!mongoose.isValidObjectId(key) && !await Product.exists({ productId: key }))) return res.status(400).json({ message: `Unknown product: ${key}` });
      const product = await Product.findOne({ $or: [{ productId: key }, ...(mongoose.isValidObjectId(key) ? [{ _id: key }] : [])] }).select('_id');
      const count = Number(item.quantity);
      if (!Number.isInteger(count) || count < 0) return res.status(400).json({ message: 'Quantity must be a non-negative integer' });
      if (count > 0) normalized.set(product._id.toString(), count);
      else normalized.delete(product._id.toString());
    }
    const cart = await Cart.findOneAndUpdate({ userId: req.user._id }, { $set: { items: [...normalized].map(([productId, quantity]) => ({ productId, quantity })) } }, { new: true, upsert: true, runValidators: true }).populate('items.productId');
    res.json({ cart });
  } catch (err) { next(err); }
}
module.exports = { getCart, updateCart };
