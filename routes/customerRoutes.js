const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkCustomerLimit } = require('../middleware/saasLimits');
const Customer = require('../models/Customer');

// Protect all customer routes
router.use(protect);

// POST: Create Customer (Validates Free/Pro Limits)
router.post('/', checkCustomerLimit, async (req, res) => {
  try {
    const newCustomer = await Customer.create({
      ...req.body,
      user: req.user._id // Critical: Force the tenant ID
    });
    res.status(201).json({
      status: 'success',
      data: newCustomer
    });
  } catch (error) {
    console.error("CREATE CUSTOMER ERROR:", error);
    res.status(400).json({ error: 'Failed to create customer.' });
  }
});

// GET: Fetch ONLY the logged-in user's customers for the directory
router.get('/', async (req, res) => {
  try {
    const customers = await Customer.find({ user: req.user._id }).sort('-createdAt');
    res.status(200).json({
      status: 'success',
      results: customers.length,
      data: customers
    });
  } catch (error) {
    console.error("GET CUSTOMERS ERROR:", error);
    res.status(500).json({ error: 'Server Error' });
  }
});

// Dynamic routes for a specific customer ID
router.route('/:id')
  // GET: Fetch a single customer's details to load the Customer Profile page
  .get(async (req, res) => {
    try {
      const customer = await Customer.findOne({ _id: req.params.id, user: req.user._id });
      if (!customer) return res.status(404).json({ error: 'Customer not found.' });
      res.status(200).json({ status: 'success', data: customer });
    } catch (error) {
      console.error("GET SINGLE CUSTOMER ERROR:", error);
      res.status(500).json({ error: 'Server Error' });
    }
  })
  // PUT: Update customer details (Saves notes and basic profile info)
  .put(async (req, res) => {
    try {
      const customer = await Customer.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        req.body,
        { new: true, runValidators: true }
      );
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      res.status(200).json({ status: 'success', data: customer });
    } catch (error) {
      console.error("UPDATE CUSTOMER ERROR:", error);
      res.status(500).json({ error: 'Server Error' });
    }
  })
  // DELETE: Remove a customer permanently
  .delete(async (req, res) => {
    try {
      const customer = await Customer.findOneAndDelete({ _id: req.params.id, user: req.user._id });
      if (!customer) return res.status(404).json({ error: 'Customer not found.' });
      res.status(200).json({ status: 'success', data: null });
    } catch (error) {
      console.error("DELETE CUSTOMER ERROR:", error);
      res.status(500).json({ error: 'Server Error' });
    }
  });

// POST: Add a sub-profile (family member/related person) to a customer
router.post('/:id/sub-profiles', async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, user: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    customer.subProfiles.push(req.body);
    await customer.save();
    res.status(201).json({ status: 'success', data: customer });
  } catch (error) {
    console.error("ADD SUB-PROFILE ERROR:", error);
    res.status(400).json({ error: 'Failed to add related profile.' });
  }
});

// PUT: Save a new measurement record to a sub-profile's history array (Fixed with _id stripping)
router.put('/:id/sub-profiles/:subId/measurements', async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, user: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const subProfile = customer.subProfiles.id(req.params.subId);
    if (!subProfile) {
      return res.status(404).json({ error: 'Sub-profile not found' });
    }

    if (!subProfile.measurements) {
      subProfile.measurements = [];
    }

    // Strip out _id to prevent duplicate key errors when saving new history entries
    const { _id, ...newMeasData } = req.body;

    // Prepend new history record to the front of the array
    subProfile.measurements.unshift(newMeasData);

    await customer.save();

    res.status(200).json({ status: 'success', data: customer });
  } catch (error) {
    console.error("SAVE SUB-PROFILE MEASUREMENT ERROR:", error);
    res.status(400).json({ error: 'Failed to save sub-profile measurements.' });
  }
});

// DELETE: Remove a sub-profile from a customer
router.delete('/:id/sub-profiles/:subId', async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, user: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    customer.subProfiles.id(req.params.subId).deleteOne();
    await customer.save();
    res.status(200).json({ status: 'success', data: customer });
  } catch (error) {
    console.error("DELETE SUB-PROFILE ERROR:", error);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;