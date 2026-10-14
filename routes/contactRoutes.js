const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { protect } = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// POST /api/contact - Public route for the contact form (rate limited in server.js)
router.post('/', async (req, res) => {
  try {
    const name = text(req.body.name, 100);
    const email = text(req.body.email, 120).toLowerCase();
    const subject = text(req.body.subject, 150);
    const message = text(req.body.message, 3000);

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Please fill in all fields.' });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    await Message.create({ name, email, subject, message });
    res.status(201).json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Contact Form Error:', error);
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

// GET /api/contact - Admin only: fetch the latest messages
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 }).limit(500);
    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    console.error('Fetch Messages Error:', error);
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// PUT /api/contact/:id/read - Admin only: mark a message as read
router.put('/:id/read', protect, adminOnly, async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    if (!message) {
      return res.status(404).json({ error: 'Message not found.' });
    }
    res.status(200).json({ success: true, data: message });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid message ID.' });
    }
    console.error('Mark Read Error:', error);
    res.status(500).json({ error: 'Failed to update message.' });
  }
});

module.exports = router;
