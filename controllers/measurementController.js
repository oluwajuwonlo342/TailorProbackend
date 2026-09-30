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
    // The customer ID is passed securely in the URL token
    const customerId = req.params.token; 
    const customer = await Customer.findById(customerId);
    
    if (!customer) {
      return res.status(404).json({ error: 'Invalid or expired link.' });
    }

    const { subProfileId, targetType, measurementsData, unit, gender } = req.body;

    if (targetType === 'subProfile' && subProfileId) {
      const subProfile = customer.subProfiles.id(subProfileId);
      if (subProfile) {
        subProfile.measurements = measurementsData;
        subProfile.gender = gender || subProfile.gender;
        await customer.save();
      }
    } else {
      // Create standard measurement record
      await Measurement.create({
        ...measurementsData,
        customer: customerId,
        user: customer.user, // Assign to the tailor
        unit,
        gender: customer.gender,
        title: 'Client Self-Measurement Form'
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

    // Check if customer already has a measurement record
    const existingCount = await Measurement.countDocuments({ customer: customerId, user: req.user._id });

    if (existingCount > 0) {
      // Check if user is on Pro plan or active Trial
      const user = await User.findById(req.user._id);
      const isPro = user.plan?.toLowerCase() === 'pro' || (user.trialEnd && new Date(user.trialEnd) > new Date());
      
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
