const express = require('express');
const router = express.Router();
const Message = require('../models/Message'); // Ensure you created models/Message.js too!
const { protect } = require('../middleware/auth');

// POST /api/contact - Public route for the contact form
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Please fill in all fields.' });
    }

    await Message.create({ name, email, subject, message });
    res.status(201).json({ success: true, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Contact Form Error:', error);
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

// GET /api/contact - Admin route to fetch all messages
router.get('/', protect, async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 }); 
    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// PUT /api/contact/:id/read - Admin route to mark message as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
    res.status(200).json({ success: true, data: message });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update message.' });
  }
});

module.exports = router;