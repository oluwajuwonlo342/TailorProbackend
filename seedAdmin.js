require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!email || password.length < 12) {
    console.error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters.');
    process.exit(1);
  }
  if (password === 'AdminSecure123!') {
    console.error('That password is compromised. Choose a new one.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to:', mongoose.connection.host, '/', mongoose.connection.name);

  let admin = await User.findOne({ email });
  if (!admin) admin = new User({ email });

  // Fill in anything the account is missing so later saves don't fail validation
  admin.fullName = admin.fullName || 'Super Admin';
  admin.businessName = admin.businessName || 'TailorPro Admin';
  admin.phone = admin.phone || '08028655278';
  admin.role = 'admin';
  admin.isSuspended = false;
  admin.password = password; // plain text on purpose: the User model hashes it on save

  await admin.save();
  console.log(`Admin ready: ${email}`);
  process.exit(0);
})().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
