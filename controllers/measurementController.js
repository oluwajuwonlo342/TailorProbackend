const Measurement = require('../models/Measurement');
const Customer = require('../models/Customer');
const User = require('../models/User');

// ==========================================================
// PUBLIC LINK CONTROLLERS (For WhatsApp Shared Links)
// ==========================================================

// Verify the public link and get basic customer/tailor info
exports.verifyPublicLink = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.token).populate('user', 'businessName fullName');
    if (!customer) {
      return res.status(404).json({ error: 'Invalid or expired link.' });
    }

    res.status(200).json({
      success: true,
      customer,
      tailorName: customer.user.businessName || customer.user.fullName
    });
  } catch (error) {
    console.error("PUBLIC LINK VERIFICATION ERROR:", error);
    res.status(404).json({ error: 'Invalid or expired link.' });
  }
};

// Handle the form submission from the public link
exports.submitPublicMeasurement = async (req, res) => {
  try {
    const customerId = req.params.token;
    const customer = await Customer.findById(customerId);

    if (!customer) {
      return res.status(404).json({ error: 'Invalid or expired link.' });
    }

    // 1. Pull out the routing data, and capture EVERYTHING else as flat measurements
    const { subProfileId, targetType, unit, gender, measurementsData, ...flatMeasurements } = req.body;

    // 2. Automatically detect where the numbers are (nested vs flat)
    const finalMeasurements = (measurementsData && Object.keys(measurementsData).length > 0)
      ? measurementsData
      : flatMeasurements;

    // 3. Guard against empty submissions (e.g. network retry with no body)
    if (!finalMeasurements || Object.keys(finalMeasurements).length === 0) {
      return res.status(400).json({ error: 'No measurement values were submitted.' });
    }

    if (targetType === 'subProfile' && subProfileId) {
      const subProfile = customer.subProfiles.id(subProfileId);
      if (!subProfile) {
        return res.status(404).json({ error: 'Sub-profile not found.' });
      }

      subProfile.measurements.push({
        title: 'WhatsApp Self-Measurement',
        unit: unit || 'inches',
        ...finalMeasurements
      });
      subProfile.gender = gender || subProfile.gender;
      await customer.save();
    } else {
      await Measurement.create({
        customer: customerId,
        user: customer.user,
        unit: unit || 'inches',
        // Use the gender the form was actually filled out for (Male/Female field set),
        // falling back to the customer's stored gender only if the form didn't send one
        gender: gender || customer.gender,
        title: 'WhatsApp Self-Measurement',
        ...finalMeasurements
      });
    }

    res.status(201).json({ success: true, message: 'Measurements submitted successfully.' });
  } catch (error) {
    console.error("PUBLIC SUBMISSION ERROR:", error);
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
    console.error("GET MEASUREMENTS ERROR:", error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// Save measurement history directly from the dashboard
exports.saveCustomerMeasurements = async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findOne({ _id: customerId, user: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    // Strip out routing/meta fields before checking whether anything real was submitted
    const { _id, title, unit, gender, recordedDate, createdAt, updatedAt, notes, ...measurementValues } = req.body;

    const hasAtLeastOneValue = Object.values(measurementValues).some(
      (v) => v !== undefined && v !== null && v !== ''
    );
    if (!hasAtLeastOneValue) {
      return res.status(400).json({ error: 'Please fill in at least one measurement before saving.' });
    }

    // Check if customer already has a measurement record
    const existingCount = await Measurement.countDocuments({ customer: customerId, user: req.user._id });

    if (existingCount > 0) {
      const user = await User.findById(req.user._id);
      const isPro = user.plan?.toLowerCase() === 'pro' || (user.trialEnd && new Date(user.trialEnd) > new Date());

      if (!isPro) {
        return res.status(403).json({
          error: 'Measurement history is a Pro feature. Upgrade to Pro to save multiple measurement records for the same customer over time.'
        });
      }
    }

    const newMeasurement = await Measurement.create({
      title,
      unit,
      gender: gender || customer.gender,
      notes,
      ...measurementValues,
      customer: customerId,
      user: req.user._id
    });

    res.status(201).json({
      status: 'success',
      data: newMeasurement
    });
  } catch (error) {
    console.error("SAVE MEASUREMENTS ERROR:", error);
    res.status(400).json({ error: error.message || 'Failed to save measurements.' });
  }
};
