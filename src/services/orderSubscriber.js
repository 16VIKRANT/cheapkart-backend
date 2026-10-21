const { getClient } = require('./solace');
const { sendEmail, emailConfigured, escapeHtml } = require('./emailService');
const mongoose = require('mongoose');
const Product = require('../models/Product');

async function notify(kind, to, subject, details, text, html) {
  if (emailConfigured()) {
    try {
      await sendEmail({ to, subject, text, html });
      console.log(`[SES EMAIL SENT: ${kind}] To: ${to}; Subject: ${subject}`);
      return true;
    } catch (err) {
      console.error(`[SES EMAIL FAILED: ${kind}] To: ${to}; ${err.name || 'Error'}: ${err.message}`);
    }
  }
  console.log(`\n[MOCK EMAIL: ${kind}]\nTo: ${to}\nSubject: ${subject}\n${JSON.stringify(details, null, 2)}\n`);
  return false;
}

async function handleInventoryUpdated(event) {
  if (!Number.isFinite(Number(event.stock)) || Number(event.stock) <= 0) return;
  const id = String(event.productId || '');
  const product = await Product.findOne({ $or: [
    { productId: id },
    ...(mongoose.isValidObjectId(id) ? [{ _id: id }] : []),
  ] }).select('name productId stock +restockSubscribers');
  if (!product || product.stock <= 0 || !product.restockSubscribers.length) return;

  for (const subscriber of product.restockSubscribers) {
    const subject = `Back in stock: ${product.name}`;
    const text = `Good news — ${product.name} is back in stock at Cheapkart. Visit the store to shop it while it’s available.`;
    const html = `<div style="font-family:Arial,sans-serif;color:#282621"><h2>It’s back in stock</h2><p>Good news — <strong>${escapeHtml(product.name)}</strong> is available again at Cheapkart.</p><p>Visit the store to shop it while it’s available.</p></div>`;
    const sent = await notify('RESTOCK ALERT', subscriber.email, subject,
      { productId: product.productId || product._id.toString(), name: product.name, stock: product.stock }, text, html);
    if (sent) {
      await Product.updateOne({ _id: product._id }, { $pull: { restockSubscribers: { userId: subscriber.userId } } });
    }
  }
}

async function handleOrderPlaced(order) {
  const adminEmail = process.env.ADMIN_ALERT_EMAIL || 'vikrant.raut1598@gmail.com';
  const sellerEmail = process.env.SELLER_ALERT_EMAIL || 'vvraut010@gmail.com';
  const safeOrderId = escapeHtml(order.orderId);
  const itemText = order.items.map((item) => `${item.name} × ${item.quantity} — ₹${item.price} each`).join('\n');
  const itemHtml = order.items.map((item) => `<li>${escapeHtml(item.name)} × ${item.quantity} — ₹${item.price} each</li>`).join('');
  const customerSubject = `Cheapkart order ${order.orderId} confirmed`;
  const customerText = `Thanks for shopping with Cheapkart!\n\nOrder ${order.orderId}\n${itemText}\n\nTotal: ₹${order.totalAmount}`;
  const customerHtml = `<div style="font-family:Arial,sans-serif;color:#282621"><h2>Thanks for shopping with Cheapkart!</h2><p>Your order <strong>${safeOrderId}</strong> is confirmed.</p><ul>${itemHtml}</ul><p><strong>Total: ₹${order.totalAmount}</strong></p></div>`;
  const adminSubject = `Cheapkart order ${order.orderId} placed`;
  const address = order.shippingAddress || {};
  const addressText = [address.street, address.city, address.pincode, address.phone].filter(Boolean).join(', ');
  const adminText = `Order ${order.orderId} was placed.\nCustomer: ${order.customer.name} (${order.customer.email})\n\nItems:\n${itemText}\n\nTotal: ₹${order.totalAmount}\nShipping address: ${addressText}`;
  const adminHtml = `<div style="font-family:Arial,sans-serif;color:#282621"><h2>New Cheapkart order</h2><p>Order <strong>${safeOrderId}</strong></p><p>Customer: ${escapeHtml(order.customer.name)} (${escapeHtml(order.customer.email)})</p><ul>${itemHtml}</ul><p><strong>Total: ₹${order.totalAmount}</strong></p><p>Shipping address: ${escapeHtml(addressText)}</p></div>`;

  await Promise.all([
    notify('CUSTOMER CONFIRMATION', order.customer.email, customerSubject,
      { items: order.items.map(({ name, quantity, price }) => ({ name, quantity, price })), totalAmount: order.totalAmount }, customerText, customerHtml),
    notify('ADMIN ORDER ALERT', adminEmail, adminSubject,
      { customer: order.customer, items: order.items, totalAmount: order.totalAmount, shippingAddress: order.shippingAddress }, adminText, adminHtml),
  ]);

  const lowStockItems = order.items.filter((entry) => Number.isFinite(Number(entry.stockAfter)) && Number(entry.stockAfter) <= 1);
  await Promise.all(lowStockItems.map((item) => {
    const to = item.sellerEmail || sellerEmail;
    const subject = `Urgent restock: ${item.name}`;
    const text = Number(item.stockAfter) === 0
      ? `This in-demand product is now out of stock and needs to be restocked urgently.\n\n${item.name} (${item.productId}) has no remaining inventory.`
      : `This is an in-demand product and needs to be restocked urgently.\n\n${item.name} (${item.productId}) has only ${item.stockAfter} item remaining.`;
    const html = `<div style="font-family:Arial,sans-serif;color:#282621"><h2>Urgent restock needed</h2><p><strong>${escapeHtml(item.name)}</strong> is an in-demand product and needs to be restocked urgently.</p><p>Product ID: ${escapeHtml(item.productId)}<br>Remaining stock: ${item.stockAfter}</p></div>`;
    return notify('SELLER LOW STOCK ALERT', to, subject, {
      productId: item.productId, name: item.name, remainingStock: item.stockAfter,
      message: 'This is an in-demand product and needs to be restocked urgently.',
    }, text, html);
  }));
}

async function startOrderSubscriber() {
  const client = getClient();
  if (!client) return;
  const topic = process.env.SOLACE_ORDERS_TOPIC || 'ecommerce/orders/placed';
  const inventoryTopic = process.env.SOLACE_INVENTORY_TOPIC || 'ecommerce/inventory/updated';
  let subscribed = false;
  const subscribe = () => {
    if (!client.connected || subscribed) return;
    subscribed = true;
    client.subscribe([topic, inventoryTopic], { qos: 1 }, (err) => {
      if (err) { subscribed = false; console.error('Could not subscribe to Solace topics:', err.message); }
      else console.log(`Subscribed to ${topic} and ${inventoryTopic}`);
    });
  };
  client.on('connect', subscribe);
  client.on('reconnect', () => { subscribed = false; });
  subscribe();
  client.on('message', (receivedTopic, message) => {
    if (receivedTopic !== topic && receivedTopic !== inventoryTopic) return;
    try {
      const event = JSON.parse(message.toString());
      if (receivedTopic === topic && event.eventType === 'ORDER_PLACED') handleOrderPlaced(event).catch((err) => console.error('Order event handler failed:', err));
      if (receivedTopic === inventoryTopic && event.eventType === 'INVENTORY_UPDATED') handleInventoryUpdated(event).catch((err) => console.error('Inventory event handler failed:', err));
    } catch (err) { console.error('Invalid order event:', err.message); }
  });
}
async function stopOrderSubscriber() { /* Shared MQTT client is closed by disconnectSolace. */ }
module.exports = { startOrderSubscriber, stopOrderSubscriber, handleOrderPlaced, handleInventoryUpdated };
