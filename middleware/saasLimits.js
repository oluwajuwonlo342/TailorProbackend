const Customer = require('../models/Customer');
const Order = require('../models/Order');

exports.checkCustomerLimit = async (req, res, next) => {
  const user = req.user;
  
  // Pro users and active trials have no limits
  if (user.plan === 'pro' || user.subscriptionStatus === 'trial') {
    return next();
  }

  // Check limit for Free users
  const customerCount = await Customer.countDocuments({ user: user._id });
  if (customerCount >= 20) {
    return res.status(403).json({ 
      error: 'Limit Reached',
      message: 'Your Free plan allows up to 20 customers. Upgrade to Pro to manage unlimited customers.'
    });
  }
  next();
};