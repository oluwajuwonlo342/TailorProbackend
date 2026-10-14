const Customer = require('../models/Customer');
const { hasProAccess } = require('../utils/proAccess');
const { FREE_CUSTOMER_LIMIT } = require('../config/plans');

exports.checkCustomerLimit = async (req, res, next) => {
  try {
    // Pro users and active trials have no limits (same rule used everywhere else)
    if (hasProAccess(req.user)) {
      return next();
    }

    // Check limit for Free users
    const customerCount = await Customer.countDocuments({ user: req.user._id });
    if (customerCount >= FREE_CUSTOMER_LIMIT) {
      const message = `Your Free plan allows up to ${FREE_CUSTOMER_LIMIT} customers. Upgrade to Pro to manage unlimited customers.`;
      return res.status(403).json({ error: message, message, code: 'LIMIT_REACHED' });
    }

    next();
  } catch (error) {
    console.error('CUSTOMER LIMIT CHECK ERROR:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
