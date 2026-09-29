const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Measurement = require('../models/Measurement');
const Customer = require('../models/Customer');
const User = require('../models/User');

// Protect all measurement routes
router.use(protect);

// GET: Fetch all measurement history records for a specific customer
router.get('/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;

    // Verify customer belongs to logged-in user
    const customer = await Customer.findOne({ _id: customerId, user: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    // Fetch measurements sorted by recency
    const measurements = await Measurement.find({ customer: customerId, user: req.user._id }).sort('-createdAt');

    res.status(200).json({
      status: 'success',
      results: measurements.length,
      data: measurements
    });
  } catch (error) {
    console.error("GET MEASUREMENTS ERROR:", error);
    res.status(500).json({ error: 'Server Error' });
  }
});

// POST: Save a new measurement record for a customer (Supports history timeline)
router.post('/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findOne({ _id: customerId, user: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    // Check if customer already has measurement records
    const existingCount = await Measurement.countDocuments({ customer: customerId, user: req.user._id });

    if (existingCount > 0) {
      // Check if user is on Pro plan or active trial
      const user = await User.findById(req.user._id);
      const isPro = user.plan === 'Pro' || (user.trialEnd && new Date(user.trialEnd) > new Date());
      
      if (!isPro) {
        return res.status(403).json({ 
          error: 'Measurement history is a Pro feature. Upgrade to Pro to save multiple measurement records for the same customer over time.' 
        });
      }
    }

    // Strip out _id to prevent E11000 duplicate key errors when creating a new history entry
    const { _id, ...measurementData } = req.body;

    // Create brand new measurement history entry
    const newMeasurement = await Measurement.create({
      ...measurementData,
      customer: customerId,
      user: req.user._id,
      gender: customer.gender
    });

    res.status(201).json({
      status: 'success',
      data: newMeasurement
    });
  } catch (error) {
    console.error("SAVE MEASUREMENTS ERROR:", error);
    res.status(400).json({ error: error.message || 'Failed to save measurements.' });
  }
});

module.exports = router;