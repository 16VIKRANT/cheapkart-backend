const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: { type: String, trim: true, required: true },
  comment: { type: String, trim: true, required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
}, { _id: false });

const sellerSchema = new mongoose.Schema({
  name: { type: String, enum: ['Rajesh Sharma', 'Priya Patil', 'Amit Kulkarni'], required: true },
  email: { type: String, default: 'vvraut010@gmail.com', lowercase: true, trim: true },
}, { _id: false });

const productSchema = new mongoose.Schema({
  productId: { type: String, unique: true, sparse: true, trim: true },
  name: { type: String, required: true, trim: true },
  gender: { type: String, enum: ['men', 'women'], required: true, lowercase: true },
  category: { type: String, enum: ['shirt', 'tshirt', 'pant', 'trackpants', 'trousers'], required: true, lowercase: true },
  price: { type: Number, required: true, min: 0 },
  image: { type: String, trim: true },
  description: { type: String, default: '' },
  stock: { type: Number, min: 0, default: 5 },
  seller: { type: sellerSchema, required: true },
  reviews: { type: [reviewSchema], default: [], validate: [(v) => v.length <= 2, 'At most two reviews are allowed'] },
  restockSubscribers: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    subscribedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true, collection: 'products' });
productSchema.path('restockSubscribers').select(false);

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema, 'products');
