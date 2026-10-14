const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  subProfileId: {
    type: mongoose.Schema.Types.ObjectId, // Optional: if the order is for a child or family member
    default: null
  },
  // Was missing, so generated order numbers were silently dropped.
  // sparse lets older orders without a number coexist with the unique index.
  orderNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  outfitName: {
    type: String,
    required: [true, 'Please specify the outfit type (e.g. Agbada, Senator Suit, Gown)'],
    trim: true
  },
  fabricDescription: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['Pending', 'In Production', 'Ready for Fitting', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  totalAmount: {
    type: Number,
    required: [true, 'Please provide the total price'],
    min: [0, 'Total amount cannot be negative']
  },
  amountPaid: {
    type: Number,
    default: 0,
    min: [0, 'Amount paid cannot be negative']
  },
  dueDate: {
    type: Date,
    required: [true, 'Please provide a completion deadline']
  },
  notes: {
    type: String,
    trim: true
  }
}, { timestamps: true });

// The Orders page and the dashboard both load a tailor's orders sorted by due date
orderSchema.index({ user: 1, dueDate: 1 });
orderSchema.index({ customer: 1 });

module.exports = mongoose.model('Order', orderSchema);
