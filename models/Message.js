const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false } // Helps you track unread messages in the dashboard
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);