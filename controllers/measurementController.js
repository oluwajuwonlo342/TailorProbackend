const Measurement = require('../models/Measurement');
const Customer = require('../models/Customer');
const User = require('../models/User');

// Get all measurement history records for a specific customer
exports.getCustomerMeasurements = async (req, res) => {
  try {
    const { customerId } = req.params;
    const customer = await Customer.findOne({ _id: customerId, user: req.user._id });
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    const measurements = await Measurement.find({ customer: customerId, user: req.user._id }).sort('-recordedDate');
    res.status(200).json({ status: 'success', results: measurements.length, data: measurements });
  } catch (error) {
    console.error("GET MEASUREMENTS ERROR:", error);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.saveCustomerMeasurements = async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findOne({ _id: customerId, user: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    // Check if customer already has a measurement record
    const existingCount = await Measurement.countDocuments({ customer: customerId, user: req.user._id });

    if (existingCount > 0) {
      // Check if user is on Pro plan or active Trial
      const user = await User.findById(req.user._id);
      const isPro = user.plan === 'Pro' || (user.trialEnd && new Date(user.trialEnd) > new Date());
      
      if (!isPro) {
        return res.status(403).json({ 
          error: 'Measurement history is a Pro feature. Upgrade to Pro to save multiple measurement records for the same customer over time.' 
        });
      }
    }

    // Destructure and strip out _id to prevent duplicate key errors when creating a new history log
    const { _id, ...measurementData } = req.body;

    // Create a brand new measurement history entry with a fresh _id
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
};
// Public submission handler for WhatsApp shared links
exports.submitPublicMeasurements = async (req, res) => {
  try {
    const { customerId, subProfileId, targetType, measurementsData, unit, gender } = req.body;
    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });

    if (targetType === 'subProfile' && subProfileId) {
      const subProfile = customer.subProfiles.id(subProfileId);
      if (subProfile) {
        subProfile.measurements = measurementsData;
        subProfile.gender = gender || subProfile.gender;
        await customer.save();
      }
    } else {
      await Measurement.create({
        ...measurementsData,
        customer: customerId,
        user: customer.user,
        unit,
        gender: customer.gender,
        title: 'WhatsApp Form Submission'
      });
    }

    res.status(200).json({ status: 'success', message: 'Measurements submitted successfully.' });
  } catch (error) {
    console.error("PUBLIC SUBMISSION ERROR:", error);
    res.status(500).json({ error: 'Server Error' });
  }
};