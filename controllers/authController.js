const User = require('../models/User');
const jwt = require('jsonwebtoken');
const formatUser = require('../utils/formatUser');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
};

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');
const cleanString = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72; // bcrypt ignores anything past 72 bytes

exports.register = async (req, res) => {
  try {
    const fullName = cleanString(req.body.fullName, 80);
    const businessName = cleanString(req.body.businessName, 80);
    const phone = cleanString(req.body.phone, 20);
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!fullName || !businessName || !email || !phone || !password) {
      return res.status(400).json({ error: 'Please fill in all required fields.' });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (typeof password !== 'string' || password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
      return res.status(400).json({
        error: `Password must be between ${MIN_PASSWORD} and ${MAX_PASSWORD} characters.`
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use.' });
    }

    // Only these fields are read from the request, so nobody can sign up as an admin or pick a plan.
    // The free trial is assigned by the model defaults.
    const user = await User.create({ fullName, businessName, email, phone, password });
    const token = signToken(user._id);

    res.status(201).json({ status: 'success', token, data: formatUser(user) });
  } catch (error) {
    console.error('REGISTRATION ERROR STACK:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already in use.' });
    }
    if (error.name === 'ValidationError') {
      const text = Object.values(error.errors).map((e) => e.message).join(' ');
      return res.status(400).json({ error: text });
    }
    res.status(500).json({ error: 'Server error while creating your account. Please try again.' });
  }
};

exports.login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Please provide email and password.' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Checked after the password, so only the real owner learns the account is suspended
    if (user.isSuspended) {
      return res.status(403).json({
        error: 'Your account has been suspended. Please contact the platform administrator.'
      });
    }

    const token = signToken(user._id);
    res.status(200).json({ status: 'success', token, data: formatUser(user) });
  } catch (error) {
    console.error('LOGIN ERROR STACK:', error);
    res.status(500).json({ error: 'Server error while logging in. Please try again.' });
  }
};

exports.getMe = async (req, res) => {
  try {
    // req.user is already populated (and kept up to date) by the 'protect' middleware
    res.status(200).json({ status: 'success', data: formatUser(req.user) });
  } catch (error) {
    console.error('GETME ERROR STACK:', error);
    res.status(500).json({ error: 'Server Error' });
  }
};
