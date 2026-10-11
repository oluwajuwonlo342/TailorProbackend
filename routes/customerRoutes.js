const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkCustomerLimit } = require('../middleware/saasLimits');
const Customer = require('../models/Customer');
const Measurement = require('../models/Measurement');
const { cleanMeasurementFields, cleanText, MAX_FIELDS } = require('../utils/sanitize');

// Protect all customer routes
router.use(protect);

// Only these fields may be set from a request, so nobody can overwrite `user`, `subProfiles`, etc.
const CUSTOMER_FIELDS = ['fullName', 'gender', 'email', 'phone', 'address', 'notes'];
const SUB_PROFILE_FIELDS = ['name', 'relationship', 'gender', 'notes'];

const pick = (source, keys) =>
  Object.fromEntries(
    keys.filter((key) => source && source[key] !== undefined).map((key) => [key, source[key]])
  );

const sendError = (res, error, label, status = 500, message = 'Server Error') => {
  console.error(`${label}:`, error);
  if (error.name === 'ValidationError') {
    const text = Object.values(error.errors).map((e) => e.message).join(' ');
    return res.status(400).json({ error: text });
  }
  return res.status(status).json({ error: message });
};

// Builds a safe measurement record from a request body
const buildRecord = (body) => {
  const { title, unit, notes, ...rest } = body || {};
  return {
    fields: cleanMeasurementFields(rest),
    title: cleanText(title, 80),
    unit: unit === 'cm' ? 'cm' : 'inches',
    notes: cleanText(notes, 500)
  };
};

// POST: Create Customer (Validates Free/Pro Limits)
router.post('/', checkCustomerLimit, async (req, res) => {
  try {
    const newCustomer = await Customer.create({
      ...pick(req.body, CUSTOMER_FIELDS),
      user: req.user._id // Critical: Force the tenant ID
    });
    res.status(201).json({ status: 'success', data: newCustomer });
  } catch (error) {
    sendError(res, error, 'CREATE CUSTOMER ERROR', 400, 'Failed to create customer.');
  }
});

// GET: Fetch ONLY the logged-in user's customers for the directory
router.get('/', async (req, res) => {
  try {
    const customers = await Customer.find({ user: req.user._id }).sort('-createdAt');
    res.status(200).json({ status: 'success', results: customers.length, data: customers });
  } catch (error) {
    sendError(res, error, 'GET CUSTOMERS ERROR');
  }
});

// Dynamic routes for a specific customer ID
router.route('/:id')
  .get(async (req, res) => {
    try {
      const customer = await Customer.findOne({ _id: req.params.id, user: req.user._id });
      if (!customer) return res.status(404).json({ error: 'Customer not found.' });
      res.status(200).json({ status: 'success', data: customer });
    } catch (error) {
      sendError(res, error, 'GET SINGLE CUSTOMER ERROR');
    }
  })
  // PUT: Update customer details (notes and basic profile info only)
  .put(async (req, res) => {
    try {
      const updates = pick(req.body, CUSTOMER_FIELDS);
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'Nothing to update.' });
      }

      const customer = await Customer.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        { $set: updates },
        { new: true, runValidators: true }
      );
      if (!customer) return res.status(404).json({ error: 'Customer not found' });
      res.status(200).json({ status: 'success', data: customer });
    } catch (error) {
      sendError(res, error, 'UPDATE CUSTOMER ERROR');
    }
  })
  // DELETE: Remove a customer and their measurements
  .delete(async (req, res) => {
    try {
      const customer = await Customer.findOneAndDelete({ _id: req.params.id, user: req.user._id });
      if (!customer) return res.status(404).json({ error: 'Customer not found.' });

      // Body measurements are personal data, so remove them too. Orders are kept as financial records.
      await Measurement.deleteMany({ customer: customer._id, user: req.user._id });

      res.status(200).json({ status: 'success', data: null });
    } catch (error) {
      sendError(res, error, 'DELETE CUSTOMER ERROR');
    }
  });

// POST: Add a sub-profile (family member/related person) to a customer
router.post('/:id/sub-profiles', async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, user: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    customer.subProfiles.push(pick(req.body, SUB_PROFILE_FIELDS));
    await customer.save();
    res.status(201).json({ status: 'success', data: customer });
  } catch (error) {
    sendError(res, error, 'ADD SUB-PROFILE ERROR', 400, 'Failed to add related profile.');
  }
});

// PUT: Save a NEW measurement record to a sub-profile's history array (prepends)
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

    const { fields, title, unit, notes } = buildRecord(req.body);
    const count = Object.keys(fields).length;
    if (count === 0) {
      return res.status(400).json({ error: 'Please add at least one measurement.' });
    }
    if (count > MAX_FIELDS) {
      return res.status(400).json({ error: `A record can have at most ${MAX_FIELDS} measurements.` });
    }

    subProfile.measurements.unshift({
      ...fields,
      title: title || 'Custom Style',
      unit,
      ...(notes ? { notes } : {})
    });

    await customer.save();
    res.status(200).json({ status: 'success', data: customer });
  } catch (error) {
    sendError(res, error, 'SAVE SUB-PROFILE MEASUREMENT ERROR', 400, 'Failed to save sub-profile measurements.');
  }
});

// PUT: Update an EXISTING measurement record within a sub-profile's history (edit, not a new entry)
router.put('/:id/sub-profiles/:subId/measurements/:measurementId', async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, user: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const subProfile = customer.subProfiles.id(req.params.subId);
    if (!subProfile) {
      return res.status(404).json({ error: 'Sub-profile not found' });
    }

    const index = subProfile.measurements.findIndex(
      (m) => String(m._id) === req.params.measurementId
    );
    if (index === -1) {
      return res.status(404).json({ error: 'Measurement record not found' });
    }

    const existing = subProfile.measurements[index];
    const { fields, title, unit, notes } = buildRecord(req.body);
    const count = Object.keys(fields).length;
    if (count === 0) {
      return res.status(400).json({ error: 'Please add at least one measurement.' });
    }
    if (count > MAX_FIELDS) {
      return res.status(400).json({ error: `A record can have at most ${MAX_FIELDS} measurements.` });
    }

    // Build a fresh record from only what was submitted, so a removed part is really dropped.
    // createdAt is preserved so an edited record keeps its place in the history.
    subProfile.measurements.splice(index, 1, {
      ...fields,
      _id: existing._id,
      recordedDate: existing.recordedDate,
      createdAt: existing.createdAt,
      title: title || existing.title || 'Custom Style',
      unit,
      ...(notes ? { notes } : {})
    });

    await customer.save();
    res.status(200).json({ status: 'success', data: customer });
  } catch (error) {
    sendError(res, error, 'UPDATE SUB-PROFILE MEASUREMENT ERROR', 400, 'Failed to update sub-profile measurement.');
  }
});

// DELETE: Remove a sub-profile from a customer
router.delete('/:id/sub-profiles/:subId', async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, user: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const subProfile = customer.subProfiles.id(req.params.subId);
    if (!subProfile) {
      return res.status(404).json({ error: 'Sub-profile not found' });
    }

    subProfile.deleteOne();
    await customer.save();

    await Measurement.deleteMany({ customer: customer._id, subProfileId: req.params.subId });

    res.status(200).json({ status: 'success', data: customer });
  } catch (error) {
    sendError(res, error, 'DELETE SUB-PROFILE ERROR');
  }
});

module.exports = router;
