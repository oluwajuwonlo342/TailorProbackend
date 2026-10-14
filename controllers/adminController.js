const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authAdmin = async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password.' });
    }

    // password is select:false in the schema, so it must be requested explicitly
    const user = await User.findOne({ email }).select('+password');

    // The reason goes to your server log only, never to the browser
    let failure = null;
    if (!user) failure = 'no account with this email in this database';
    else if (user.role !== 'admin') failure = `account exists but its role is "${user.role}"`;
    else if (!(await user.comparePassword(password, user.password))) failure = 'wrong password';

    if (failure) {
      console.log(`[Admin Login Failed] ${email}: ${failure}`);
      return res.status(401).json({ error: 'Invalid administrator credentials.' });
    }

    if (user.isSuspended) {
      return res.status(403).json({ error: 'This account has been suspended.' });
    }

    // No fallback secret: if JWT_SECRET is missing this throws, and the failure is logged below
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '12h' });

    const admin = {
      _id: user._id,
      fullName: user.fullName || 'Super Administrator',
      email: user.email,
      role: user.role
    };

    console.log(`[Admin Login Success] ${email}`);
    // Fields appear both at the top level and under "data", so old and new frontend code both work
    return res.status(200).json({ status: 'success', token, ...admin, data: admin });
  } catch (err) {
    console.error('ADMIN LOGIN ERROR:', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
};

module.exports = { authAdmin };
