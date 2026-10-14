require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const Order = require('../models/Order');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const orders = await Order.find({ orderNumber: { $exists: false } }).select('_id');

  for (const order of orders) {
    await Order.updateOne(
      { _id: order._id },
      { $set: { orderNumber: `ORD-${crypto.randomBytes(4).toString('hex').toUpperCase()}` } }
    );
  }

  console.log(`Numbered ${orders.length} existing orders.`);
  process.exit(0);
})();
