const Product = require('../models/Product');
const mongoose = require('mongoose');

async function listProducts(req, res, next) {
  try {
    const filter = {};
    if (req.query.gender) filter.gender = String(req.query.gender).toLowerCase();
    if (req.query.category) filter.category = String(req.query.category).toLowerCase();
    const sort = {};
    if (req.query.sort === 'price_asc' || req.query.sort === 'price') sort.price = 1;
    if (req.query.sort === 'price_desc') sort.price = -1;
    const products = await Product.find(filter).sort(sort).lean();
    res.json({ products, count: products.length });
  } catch (err) { next(err); }
}
async function getProduct(req, res, next) {
  try {
    const id = req.params.id;
    const product = await Product.findOne({ $or: [{ productId: id }, ...(mongoose.isValidObjectId(id) ? [{ _id: id }] : [])] }).lean();
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ product });
  } catch (err) { next(err); }
}
async function notifyWhenAvailable(req, res, next) {
  try {
    const id = req.params.id;
    const product = await Product.findOne({ $or: [{ productId: id }, ...(mongoose.isValidObjectId(id) ? [{ _id: id }] : [])] }).select('_id stock');
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.stock > 0) return res.status(409).json({ message: 'This product is already available.' });
    await Product.updateOne(
      { _id: product._id, stock: 0, 'restockSubscribers.userId': { $ne: req.user._id } },
      { $push: { restockSubscribers: { userId: req.user._id, email: req.user.email } } },
    );
    const currentProduct = await Product.findById(product._id).select('stock');
    if (!currentProduct || currentProduct.stock > 0) return res.status(409).json({ message: 'This product just came back in stock.' });
    res.status(201).json({ message: 'You’re on the list. We’ll email you when this is back in stock.' });
  } catch (err) { next(err); }
}
module.exports = { listProducts, getProduct, notifyWhenAvailable };
