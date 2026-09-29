require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const email = 'admin@tailorpro.com';
  const hash = await bcrypt.hash('AdminSecure123!', 12);

  // updateOne bypasses pre-save hooks, so we hash manually and avoid double hashing
  const res = await User.collection.updateOne(
    { email },
    {
      $set: { password: hash, role: 'admin', fullName: 'Super Admin' },
      $setOnInsert: { email, createdAt: new Date() },
    },
    { upsert: true }
  );
  console.log('Admin upserted:', res.acknowledged);
  await mongoose.disconnect();
})();