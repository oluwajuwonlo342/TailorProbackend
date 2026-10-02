const Portfolio = require('../models/Portfolio');
const User = require('../models/User');

// ==========================================================
// DASHBOARD CONTROLLERS (Tailor logged in)
// ==========================================================

// GET all of the logged-in tailor's own portfolio pieces
exports.getMyPortfolio = async (req, res) => {
  try {
    const items = await Portfolio.find({ user: req.user._id }).sort('-createdAt');
    res.status(200).json({ status: 'success', results: items.length, data: items });
  } catch (error) {
    console.error('GET PORTFOLIO ERROR:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// POST a new piece with one or more photos
exports.createPortfolioItem = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Please provide a title for this piece.' });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'Please upload at least one photo.' });
    }

    const item = await Portfolio.create({
      user: req.user._id,
      title: title.trim(),
      description: (description || '').trim(),
      images: files.map((f) => f.path)
    });

    res.status(201).json({ status: 'success', data: item });
  } catch (error) {
    console.error('CREATE PORTFOLIO ITEM ERROR:', error);
    res.status(400).json({ error: error.message || 'Failed to create portfolio piece.' });
  }
};

// PUT: edit title/description, remove specific photos, and/or add new ones
exports.updatePortfolioItem = async (req, res) => {
  try {
    const item = await Portfolio.findOne({ _id: req.params.id, user: req.user._id });
    if (!item) {
      return res.status(404).json({ error: 'Portfolio piece not found.' });
    }

    const { title, description, removeImages } = req.body;

    if (title !== undefined) item.title = title.trim();
    if (description !== undefined) item.description = description.trim();

    // removeImages arrives as a single string or an array of URLs to drop
    if (removeImages) {
      const toRemove = Array.isArray(removeImages) ? removeImages : [removeImages];
      item.images = item.images.filter((url) => !toRemove.includes(url));
    }

    const newFiles = req.files || [];
    if (newFiles.length > 0) {
      item.images.push(...newFiles.map((f) => f.path));
    }

    if (item.images.length === 0) {
      return res.status(400).json({ error: 'A portfolio piece must have at least one photo.' });
    }

    await item.save();
    res.status(200).json({ status: 'success', data: item });
  } catch (error) {
    console.error('UPDATE PORTFOLIO ITEM ERROR:', error);
    res.status(400).json({ error: error.message || 'Failed to update portfolio piece.' });
  }
};

// DELETE a piece entirely
exports.deletePortfolioItem = async (req, res) => {
  try {
    const item = await Portfolio.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!item) {
      return res.status(404).json({ error: 'Portfolio piece not found.' });
    }
    res.status(200).json({ status: 'success', data: null });
  } catch (error) {
    console.error('DELETE PORTFOLIO ITEM ERROR:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// ==========================================================
// PUBLIC CONTROLLER (No auth — the shareable page)
// ==========================================================

exports.getPublicPortfolio = async (req, res) => {
  try {
    const tailor = await User.findById(req.params.userId).select('businessName fullName profilePhoto phone');
    if (!tailor) {
      return res.status(404).json({ error: 'Portfolio not found.' });
    }

    const items = await Portfolio.find({ user: req.params.userId }).sort('-createdAt');

    res.status(200).json({
      status: 'success',
      tailor: {
        businessName: tailor.businessName,
        fullName: tailor.fullName,
        profilePhoto: tailor.profilePhoto,
        phone: tailor.phone
      },
      data: items
    });
  } catch (error) {
    console.error('GET PUBLIC PORTFOLIO ERROR:', error);
    res.status(404).json({ error: 'Portfolio not found.' });
  }
};
