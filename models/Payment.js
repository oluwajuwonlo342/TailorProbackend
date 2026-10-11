const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reference: { type: String, required: true, unique: true },
  amount: { type: Number, required: true }, // in kobo
  currency: { type: String, default: 'NGN' },
  paidAt: { type: Date },
  periodEnd: { type: Date } // the user's subscriptionEnd after this payment was applied
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
