const Customer = require('../models/Customer');
const User = require('../models/User');

// Get all customers for logged-in user
exports.getCustomers = async (req, res) => {
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
};

// Add a new customer (Enforcing Free Plan Limit of 20)
exports.createCustomer = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    // Check if user is on Free plan and has reached the 20 customer limit
    if (user.plan === 'free') {
      const customerCount = await Customer.countDocuments({ user: userId });
      if (customerCount >= 20) {
        return res.status(403).json({ 
          error: 'Free plan limit reached (max 20 customers). Please upgrade to Pro for unlimited customers.' 
        });
      }
    }

    const { fullName, email, phone, address, notes } = req.body;

    const newCustomer = await Customer.create({
      user: userId,
      fullName,
      email,
      phone,
      address,
      notes
    });

    res.status(201).json({
      status: 'success',
      data: newCustomer
    });
  } catch (error) {
    console.error("CREATE CUSTOMER ERROR:", error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

// Delete a customer
exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.status(200).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    console.error("DELETE CUSTOMER ERROR:", error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// Update a customer (e.g., saving notes)
exports.updateCustomer = async (req, res) => {
  try {
    // Find the customer by ID and ensure they belong to the logged-in user
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.status(200).json({
      status: 'success',
      data: customer
    });
  } catch (error) {
    console.error("UPDATE CUSTOMER ERROR:", error);
    res.status(500).json({ error: 'Server Error' });
  }
};