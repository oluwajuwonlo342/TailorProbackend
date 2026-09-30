const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Measurement = require('../models/Measurement');
const Customer = require('../models/Customer');
const User = require('../models/User');
const {
  verifyPublicLink,
  submitPublicMeasurement,
} = require('../controllers/measurementController');

// ==========================================================
// 1. PUBLIC ROUTES (MUST GO BEFORE THE PROTECT MIDDLEWARE)
// ==========================================================

router.get('/public/:token', verifyPublicLink);
router.post('/public/:token', submitPublicMeasurement);

// ==========================================================
// 2. AUTH MIDDLEWARE (LOCKS DOWN EVERYTHING BELOW THIS LINE)
// ==========================================================
router.use(protect);

// ==========================================================
// 3. SECURE DASHBOARD ROUTES
// ==========================================================

router.get('/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const customer = await Customer.findOne({ _id: customerId, user: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const measurements = await Measurement.find({ customer: customerId, user: req.user._id }).sort('-createdAt');

    res.status(200).json({
      status: 'success',
      results: measurements.length,
      data: measurements,
    });
  } catch (error) {
    console.error('GET MEASUREMENTS ERROR:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

router.post('/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findOne({ _id: customerId, user: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const existingCount = await Measurement.countDocuments({ customer: customerId, user: req.user._id });

    if (existingCount > 0) {
      const user = await User.findById(req.user._id);
      const isPro = user.plan?.toLowerCase() === 'pro' || (user.trialEnd && new Date(user.trialEnd) > new Date());

      if (!isPro) {
        return res.status(403).json({
          error: 'Measurement history is a Pro feature. Upgrade to Pro to save multiple measurement records for the same customer over time.',
        });
      }
    }

    const { _id, ...measurementData } = req.body;

    const newMeasurement = await Measurement.create({
      ...measurementData,
      customer: customerId,
      user: req.user._id,
      gender: customer.gender,
    });

    res.status(201).json({
      status: 'success',
      data: newMeasurement,
    });
  } catch (error) {
    console.error('SAVE MEASUREMENTS ERROR:', error);
    res.status(400).json({ error: error.message || 'Failed to save measurements.' });
  }
});

module.exports = router;
