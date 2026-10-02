// controllers/portfolioController.js
const Portfolio = require('../models/Portfolio');
const User = require('../models/User');

const GENDERS = ['Male', 'Female', 'Unisex', 'Kids'];

/*
 * Reads the optional fashion fields from req.body (multipart form values arrive as strings).
 * - Only fields that were actually sent are returned, so a partial update never wipes others.
 * - An empty string means "clear this field" (returned as undefined, which unsets it in Mongoose).
 * - Returns { fields, errors } so the caller can reply with a clear 400 message.
 */
const parseOptionalFields = (body) => {
  const fields = {};
  const errors = [];

  const text = (key, label, max) => {
    if (body[key] === undefined) return;
    const value = String(body[key]).trim();
    if (value.length > max) {
      errors.push(`${label} is too long (max ${max} characters).`);
      return;
    }
    fields[key] = value || undefined;
  };
  text('category', 'Category', 60);
  text('occasion', 'Occasion', 60);
  text('fabric', 'Fabric', 100);

  if (body.gender !== undefined) {
    const gender = String(body.gender).trim();
    if (gender && !GENDERS.includes(gender)) {
      errors.push('Gender must be one of: Male, Female, Unisex, Kids.');
    } else {
      fields.gender = gender || undefined;
    }
  }

  const number = (key, label) => {
    if (body[key] === undefined) return;
    const raw = String(body[key]).trim();
    if (raw === '') {
      fields[key] = undefined;
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      errors.push(`${label} must be a positive number.`);
      return;
    }
    fields[key] = n;
  };
  number('startingPrice', 'Starting price');
  number('turnaroundDays', 'Turnaround days');

  // The form sends "YYYY-MM" (month picker)
  if (body.completedDate !== undefined) {
    const raw = String(body.completedDate).trim();
    if (raw === '') {
      fields.completedDate = undefined;
    } else {
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) errors.push('Completed date is not valid.');
      else fields.completedDate = date;
    }
  }

  if (body.featured !== undefined) {
    fields.featured = body.featured === true || body.featured === 'true';
  }

  return { fields, errors };
};

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

    const { fields, errors } = parseOptionalFields(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(' ') });
    }

    // New pieces must say who they're for and what they are (needed for the public filters)
    if (!fields.gender) {
      return res.status(400).json({ error: 'Please choose who this piece is made for (Women, Men, Unisex or Kids).' });
    }
    if (!fields.category) {
      return res.status(400).json({ error: 'Please choose a category for this piece.' });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'Please upload at least one photo.' });
    }

    const item = await Portfolio.create({
      user: req.user._id,
      title: title.trim(),
      description: (description || '').trim(),
      images: files.map((f) => f.path),
      ...fields
    });

    res.status(201).json({ status: 'success', data: item });
  } catch (error) {
    console.error('CREATE PORTFOLIO ITEM ERROR:', error);
    res.status(400).json({ error: error.message || 'Failed to create portfolio piece.' });
  }
};

// PUT: edit details, remove specific photos, and/or add new ones
exports.updatePortfolioItem = async (req, res) => {
  try {
    const item = await Portfolio.findOne({ _id: req.params.id, user: req.user._id });
    if (!item) {
      return res.status(404).json({ error: 'Portfolio piece not found.' });
    }

    const { title, description, removeImages } = req.body;

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({ error: 'Please provide a title for this piece.' });
      }
      item.title = title.trim();
    }
    if (description !== undefined) item.description = description.trim();

    const { fields, errors } = parseOptionalFields(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(' ') });
    }
    Object.entries(fields).forEach(([key, value]) => {
      item[key] = value; // undefined clears the field
    });

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
    // `bio`, `location` and `coverImage` are optional: if your User model doesn't have them yet,
    // they simply come back empty and the public page hides those sections.
    // (Home address is deliberately not exposed on the public page.)
    const tailor = await User.findById(req.params.userId)
      .select('businessName fullName profilePhoto phone bio location coverImage');
    if (!tailor) {
      return res.status(404).json({ error: 'Portfolio not found.' });
    }

    // Featured pieces first, then newest
    const items = await Portfolio.find({ user: req.params.userId })
      .sort({ featured: -1, createdAt: -1 });

    res.status(200).json({
      status: 'success',
      tailor: {
        businessName: tailor.businessName,
        fullName: tailor.fullName,
        profilePhoto: tailor.profilePhoto,
        phone: tailor.phone,
        bio: tailor.bio,
        location: tailor.location,
        coverImage: tailor.coverImage
      },
      data: items
    });
  } catch (error) {
    console.error('GET PUBLIC PORTFOLIO ERROR:', error);
    res.status(404).json({ error: 'Portfolio not found.' });
  }
};
