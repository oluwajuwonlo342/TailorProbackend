const User = require('../models/User');
const jwt = require('jsonwebtoken');
const formatUser = require('../utils/formatUser');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
};

const normalizeEmail = (email) => typeof email === 'string' ? email.trim().toLowerCase() : '';

exports.register = async (req, res) => {
  try {
    const { fullName, businessName, phone, password } = req.body;
    const email = normalizeEmail(req.body.email);
    
    if (!fullName || !businessName || !email || !phone || !password) {
      return res.status(400).json({ error: 'Please fill in all required fields.' });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use.' });
    }
    
    // Creates user, automatically assigning the 14-day trial via Model defaults
    const user = await User.create({ fullName, businessName, email, phone, password });
    const token = signToken(user._id);
    
    res.status(201).json({ status: 'success', token, data: formatUser(user) });
  } catch (error) {
    console.error('REGISTRATION ERROR STACK:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already in use.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

exports.login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password.' });
    }
    
    const user = await User.findOne({ email }).select('+password');
    
    if (!user || !(await user.comparePassword(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // --- NEW SUSPENSION CHECK ---
    if (user.isSuspended) {
      return res.status(403).json({ 
        error: 'Your account has been suspended. Please contact the platform administrator.' 
      });
    }

    const token = signToken(user._id);
    res.status(200).json({ status: 'success', token, data: formatUser(user) });
  } catch (error) {
    console.error('LOGIN ERROR STACK:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};

exports.getMe = async (req, res) => {
  try {
    // req.user is already populated by the 'protect' middleware
    res.status(200).json({ status: 'success', data: formatUser(req.user) });
  } catch (error) {
    console.error('GETME ERROR STACK:', error);
    res.status(500).json({ error: error.message || 'Server Error' });
  }
};