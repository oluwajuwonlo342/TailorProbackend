// models/Portfolio.js
const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: [true, 'Please provide a title for this piece'], trim: true },
  description: { type: String, trim: true, default: '' },
  images: {
    type: [String],
    validate: {
      validator: (arr) => Array.isArray(arr) && arr.length > 0,
      message: 'At least one photo is required.'
    }
  },

  // Who the piece is made for. Powers the Women / Men / Unisex / Kids tabs on the public page.
  // Not `required` here on purpose: pieces uploaded before this field existed have no gender,
  // and a required field would make saving them (e.g. pinning as featured) fail.
  // The controller requires it when creating a new piece.
  gender: { type: String, enum: ['Male', 'Female', 'Unisex', 'Kids'] },

  category: { type: String, trim: true, maxlength: 60 },
  occasion: { type: String, trim: true, maxlength: 60 },
  fabric: { type: String, trim: true, maxlength: 100 },
  startingPrice: { type: Number, min: 0 },
  turnaroundDays: { type: Number, min: 0 },
  completedDate: { type: Date },
  featured: { type: Boolean, default: false }
}, { timestamps: true });

portfolioSchema.index({ user: 1, featured: -1, createdAt: -1 });

module.exports = mongoose.model('Portfolio', portfolioSchema);
