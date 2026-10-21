require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../src/models/Product');

const sellers = ['Rajesh Sharma', 'Priya Patil', 'Amit Kulkarni'];
async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cheapkart' });
  const products = await Product.find().select('_id productId name').sort({ _id: 1 }).lean();
  const ops = products.map((product, index) => ({
    updateOne: {
      filter: { _id: product._id },
      update: { $set: {
        stock: 5,
        seller: { name: sellers[index % sellers.length], email: process.env.SELLER_ALERT_EMAIL || 'vvraut010@gmail.com' },
        // Demo-only review data, with distinct reviewer names and comments per product.
        reviews: [
          { user: `Aarav_${index + 1}`, comment: `Comfortable fit and good quality for ${product.name}.`, rating: 5 },
          { user: `Meera_${index + 1}`, comment: `Nice fabric and finish; happy with this purchase.`, rating: 4 },
        ],
      } },
    },
  }));
  if (ops.length) await Product.bulkWrite(ops, { ordered: false });
  console.log(`Initialized ${products.length} products: stock 5, sellers evenly assigned, two demo reviews each.`);
  await mongoose.disconnect();
}
main().catch(async (err) => { console.error(err); await mongoose.disconnect(); process.exitCode = 1; });
