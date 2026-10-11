const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Check if the token exists in the Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authorized to access this route. No token provided.' });
    }

    // 2. Verify and decode the token (only a bad token is a 401)
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
    }

    // 3. Find the user in the database (this makes req.user.role available for admin checks)
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ error: 'The user belonging to this token no longer exists.' });
    }

    // 4. Instantly kick out active users if an admin suspended their account
    if (req.user.isSuspended) {
      return res.status(403).json({
        error: 'Your account has been suspended. Please contact the platform administrator.'
      });
    }

    // 5. Downgrade expired plans automatically
    const now = new Date();
    let downgraded = false;

    // Free trial ran out. The trialEnd check matters: an empty date compares as 1970 and would downgrade by mistake.
    if (req.user.subscriptionStatus === 'trial' && req.user.trialEnd && now > req.user.trialEnd) {
      req.user.subscriptionStatus = 'free';
      req.user.plan = 'free';
      downgraded = true;
    }

    // Paid subscription ran out (only when an end date was recorded)
    if (req.user.plan === 'pro' && req.user.subscriptionEnd && now > req.user.subscriptionEnd) {
      req.user.subscriptionStatus = 'expired';
      req.user.plan = 'free';
      downgraded = true;
    }

    if (downgraded) {
      // updateOne skips full-document validation, so one oddly saved old account can't break every request
      await User.updateOne(
        { _id: req.user._id },
        { $set: { plan: req.user.plan, subscriptionStatus: req.user.subscriptionStatus } }
      );
    }

    // 6. Grant access to the protected route
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
};

module.exports = { protect };
