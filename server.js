require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { connectSolace, disconnectSolace } = require('./src/services/solace');
const { startOrderSubscriber, stopOrderSubscriber } = require('./src/services/orderSubscriber');
const { seedAdmin } = require('./src/services/seedAdmin');
const authRoutes = require('./src/routes/authRoutes');
const productRoutes = require('./src/routes/productRoutes');
const cartRoutes = require('./src/routes/cartRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

const app = express();
app.disable('x-powered-by');
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Internal server error' });
});

const port = Number(process.env.PORT) || 5000;
let server;

async function start() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cheapkart' });
  console.log('Connected to MongoDB database cheapkart');
  await seedAdmin();
  await connectSolace();
  await startOrderSubscriber();
  server = app.listen(port, () => console.log(`Cheapkart API listening on port ${port}`));
}

async function shutdown() {
  console.log('Shutting down...');
  if (server) await new Promise((resolve) => server.close(resolve));
  await stopOrderSubscriber();
  await disconnectSolace();
  await mongoose.disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
start().catch((err) => { console.error('Startup failed:', err.message); process.exit(1); });

module.exports = app;
