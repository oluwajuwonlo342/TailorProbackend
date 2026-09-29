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
  outfitName: {
    type: String,
    required: [true, 'Please specify the outfit type (e.g. Agbada, Senator Suit, Gown)']
  },
  fabricDescription: {
    type: String
  },
 status: {
  type: String,
  enum: ['Pending', 'In Production', 'Ready for Fitting', 'Delivered', 'Cancelled'],
  default: 'Pending'
},
  totalAmount: {
    type: Number,
    required: [true, 'Please provide the total price']
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  dueDate: {
    type: Date,
    required: [true, 'Please provide a completion deadline']
  },
  notes: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);