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
  }
}, { timestamps: true });

module.exports = mongoose.model('Portfolio', portfolioSchema);
