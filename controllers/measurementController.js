const Measurement = require('../models/Measurement');
const Customer = require('../models/Customer');
const { cleanMeasurementFields, cleanText, MAX_FIELDS } = require('../utils/sanitize');
const { hasProAccess } = require('../utils/proAccess');

const pickUnit = (unit) => (unit === 'cm' ? 'cm' : 'inches');
const pickGender = (gender, fallback) =>
  ['Male', 'Female', 'Unisex'].includes(gender) ? gender : fallback;
const asObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};

// ==========================================================
// PUBLIC LINK CONTROLLERS (For WhatsApp Shared Links)
// ==========================================================

// Returns only what the public form needs. Nothing private (phone, email, address, notes).
exports.verifyPublicLink = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.token).populate('user', 'businessName fullName');
    if (!customer) {
      return res.status(404).json({ error: 'Invalid or expired link.' });
    }

    res.status(200).json({
      success: true,
      customer: {
        _id: customer._id,
        fullName: customer.fullName,
        gender: customer.gender,
        subProfiles: customer.subProfiles.map((sp) => ({
          _id: sp._id,
          name: sp.name,
          relationship: sp.relationship,
          gender: sp.gender
        }))
      },
      tailorName: customer.user.businessName || customer.user.fullName
    });
  } catch (error) {
    console.error('PUBLIC LINK VERIFICATION ERROR:', error);
    res.status(404).json({ error: 'Invalid or expired link.' });
  }
};

// Handle the form submission from the public link
exports.submitPublicMeasurement = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.token);
    if (!customer) {
      return res.status(404).json({ error: 'Invalid or expired link.' });
    }

    const { subProfileId, targetType, unit, gender, title, measurementsData, ...flat } = req.body;

    // Accept both the flat shape and the older nested shape, keeping only safe keys and values
    const fields = cleanMeasurementFields({ ...flat, ...asObject(measurementsData) });
    const count = Object.keys(fields).length;
    if (count === 0 || count > MAX_FIELDS) {
      return res.status(400).json({ error: `Please submit between 1 and ${MAX_FIELDS} measurement values.` });
    }

    const recordTitle = cleanText(title, 80) || 'WhatsApp Self-Measurement';
    const safeUnit = pickUnit(unit);

    if (targetType === 'subProfile' && subProfileId) {
      const subProfile = customer.subProfiles.id(subProfileId);
      if (!subProfile) {
        return res.status(404).json({ error: 'Sub-profile not found.' });
      }

      // Public links must never edit profile details, so the sub-profile's gender is left alone
      subProfile.measurements.unshift({ ...fields, title: recordTitle, unit: safeUnit });
      await customer.save();
    } else {
      await Measurement.create({
        title: recordTitle,
        unit: safeUnit,
        gender: pickGender(gender, customer.gender),
        measurementsData: fields,
        customer: customer._id,
        user: customer.user // taken from the customer, never from the request
      });
    }

    res.status(201).json({ success: true, message: 'Measurements submitted successfully.' });
  } catch (error) {
    console.error('PUBLIC SUBMISSION ERROR:', error);
    res.status(500).json({ error: 'Failed to submit measurements. Please try again.' });
  }
};

// ==========================================================
// SECURE DASHBOARD CONTROLLERS (Tailor Logged In)
// ==========================================================

// Get all measurement history records for a specific customer
exports.getCustomerMeasurements = async (req, res) => {
  try {
    const { customerId } = req.params;
    const customer = await Customer.findOne({ _id: customerId, user: req.user._id });
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    const measurements = await Measurement.find({ customer: customerId, user: req.user._id }).sort('-createdAt');
    res.status(200).json({ status: 'success', results: measurements.length, data: measurements });
  } catch (error) {
    console.error('GET MEASUREMENTS ERROR:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// Save a new measurement record from the dashboard
exports.saveCustomerMeasurements = async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findOne({ _id: customerId, user: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const { title, unit, gender, notes, measurementsData, ...rest } = req.body;
    const fields = cleanMeasurementFields({ ...rest, ...asObject(measurementsData) });
    const count = Object.keys(fields).length;
    if (count === 0) {
      return res.status(400).json({ error: 'Please fill in at least one measurement before saving.' });
    }
    if (count > MAX_FIELDS) {
      return res.status(400).json({ error: `A record can have at most ${MAX_FIELDS} measurements.` });
    }

    // Free users keep one record per customer; history is a Pro feature
    const existingCount = await Measurement.countDocuments({ customer: customerId, user: req.user._id });
    if (existingCount > 0 && !hasProAccess(req.user)) {
      return res.status(403).json({
        error: 'Measurement history is a Pro feature. Upgrade to Pro to save multiple measurement records for the same customer over time.'
      });
    }

    const newMeasurement = await Measurement.create({
      title: cleanText(title, 80) || 'Custom Style',
      unit: pickUnit(unit),
      gender: pickGender(gender, customer.gender),
      notes: cleanText(notes, 500) || undefined,
      measurementsData: fields,
      customer: customerId,
      user: req.user._id
    });

    res.status(201).json({ status: 'success', data: newMeasurement });
  } catch (error) {
    console.error('SAVE MEASUREMENTS ERROR:', error);
    res.status(400).json({ error: error.message || 'Failed to save measurements.' });
  }
};

// Keys that describe the record itself; anything else at the top level is a stray measurement part
const STRUCTURAL_KEYS = [
  '_id', '__v', 'user', 'customer', 'subProfileId', 'targetType', 'title', 'unit',
  'gender', 'notes', 'recordedDate', 'measurementsData', 'createdAt', 'updatedAt'
];

// Update an EXISTING measurement record in place (edit, not a new history entry)
exports.updateCustomerMeasurement = async (req, res) => {
  try {
    const measurement = await Measurement.findOne({ _id: req.params.measurementId, user: req.user._id });
    if (!measurement) {
      return res.status(404).json({ error: 'Measurement record not found.' });
    }

    const { title, unit, notes, measurementsData, ...rest } = req.body;
    const fields = cleanMeasurementFields({ ...rest, ...asObject(measurementsData) });
    const count = Object.keys(fields).length;
    if (count === 0) {
      return res.status(400).json({ error: 'Please fill in at least one measurement before saving.' });
    }
    if (count > MAX_FIELDS) {
      return res.status(400).json({ error: `A record can have at most ${MAX_FIELDS} measurements.` });
    }

    const newTitle = cleanText(title, 80);
    if (newTitle) measurement.title = newTitle;
    if (unit) measurement.unit = pickUnit(unit);
    if (notes !== undefined) measurement.notes = cleanText(notes, 500);

    // Replace the parts entirely so a part removed in the edit form is really gone
    measurement.measurementsData = fields;

    // Records saved before this fix (public submissions, old fixed fields) keep parts as
    // top-level keys. Clear them so removed parts can't reappear.
    Object.keys(measurement.toObject()).forEach((key) => {
      if (!STRUCTURAL_KEYS.includes(key)) {
        measurement.set(key, undefined, { strict: false });
      }
    });

    await measurement.save();

    res.status(200).json({ status: 'success', data: measurement });
  } catch (error) {
    console.error('UPDATE MEASUREMENT ERROR:', error);
    res.status(400).json({ error: error.message || 'Failed to update measurement.' });
  }
};
