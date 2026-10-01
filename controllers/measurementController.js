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

    // Pull out known fields, allowing any extra fields to be captured dynamically
    const { _id, title, unit, gender, recordedDate, createdAt, updatedAt, notes, measurementsData, ...dynamicFields } = req.body;

    // Combine any existing measurementsData with any flat dynamic fields submitted
    const finalMeasurementsData = {
      ...(measurementsData || {}),
      ...dynamicFields
    };

    const hasAtLeastOneValue = Object.values(finalMeasurementsData).some(
      (v) => v !== undefined && v !== null && v !== ''
    );
    if (!hasAtLeastOneValue && !title && !notes) {
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
      measurementsData: finalMeasurementsData,
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

// Update an EXISTING measurement record in place (edit, not a new history entry)
exports.updateCustomerMeasurement = async (req, res) => {
  try {
    const { measurementId } = req.params;

    const measurement = await Measurement.findOne({ _id: measurementId, user: req.user._id });
    if (!measurement) {
      return res.status(404).json({ error: 'Measurement record not found.' });
    }

    const { _id, customer, user, createdAt, updatedAt, recordedDate, measurementsData, title, unit, gender, notes, ...dynamicFields } = req.body;

    const finalMeasurementsData = {
      ...(measurementsData || {}),
      ...dynamicFields
    };

    const hasAtLeastOneValue = Object.values(finalMeasurementsData).some(
      (v) => v !== undefined && v !== null && v !== ''
    );
    if (!hasAtLeastOneValue) {
      return res.status(400).json({ error: 'Please fill in at least one measurement before saving.' });
    }

    if (title) measurement.title = title;
    if (unit) measurement.unit = unit;
    if (notes !== undefined) measurement.notes = notes;

    // Replace the measurementsData object entirely (rather than merging) so
    // a part removed in the edit form is actually dropped from the record.
    measurement.measurementsData = finalMeasurementsData;

    // Clear any legacy top-level predefined fields (neck, shoulder, etc.) left over
    // from the old hardcoded form, so an edit fully replaces old data cleanly.
    const predefinedKeys = [
      'neck', 'shoulder', 'chest', 'waist', 'armHole', 'sleeveLength', 'bicep', 'wrist', 'topLength',
      'bust', 'underBust', 'shoulderToNipple', 'shoulderToUnderBust', 'halfLength', 'gownLength',
      'trouserWaist', 'hips', 'thigh', 'knee', 'calf', 'instep', 'trouserLength', 'inseam', 'skirtLength'
    ];
    predefinedKeys.forEach((key) => {
      measurement.set(key, undefined);
    });

    await measurement.save();

    res.status(200).json({ status: 'success', data: measurement });
  } catch (error) {
    console.error("UPDATE MEASUREMENT ERROR:", error);
    res.status(400).json({ error: error.message || 'Failed to update measurement.' });
  }
};
