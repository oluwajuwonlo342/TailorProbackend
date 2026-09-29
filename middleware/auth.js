const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;
    
    // 1. Check if the token exists in the Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
      return res.status(401).json({ error: 'Not authorized to access this route. No token provided.' });
    }
    
    // 2. Verify and decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. Find the user in the database (this makes req.user.role available for admin checks!)
    req.user = await User.findById(decoded.id).select('-password');
    
    if (!req.user) {
      return res.status(401).json({ error: 'The user belonging to this token no longer exists.' });
    }

    // --- NEW SUSPENSION CHECK ---
    // Instantly kick out active users if their account was just suspended by an admin
    if (req.user.isSuspended) {
      return res.status(403).json({ 
        error: 'Your account has been suspended. Please contact the platform administrator.' 
      });
    }
    
    // 4. Update SaaS trial status dynamically if expired
    if (req.user.subscriptionStatus === 'trial' && new Date() > req.user.trialEnd) {
      req.user.subscriptionStatus = 'free';
      req.user.plan = 'free';
      await req.user.save();
    }
    
    // 5. Grant access to the protected route
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error.message);
    res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
};

module.exports = { protect };