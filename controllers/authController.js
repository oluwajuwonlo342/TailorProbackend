const crypto = require('crypto');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const formatUser = require('../utils/formatUser');
const { sendEmail, escapeHtml } = require('../utils/sendEmail');

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
const RESET_MINUTES = 30;

// Same reply whether or not the email exists, so this can't be used to find out who has an account
const RESET_REQUESTED_MESSAGE =
  'If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const buildResetEmail = (name, link) => {
  const safeName = escapeHtml(name || 'there');
  const safeLink = escapeHtml(link);

  return {
    subject: 'Reset your TailorPro password',
    text:
      `Hello ${name || 'there'},\n\n` +
      `We received a request to reset your TailorPro password. Open this link to choose a new one ` +
      `(it expires in ${RESET_MINUTES} minutes):\n\n${link}\n\n` +
      `If you didn't ask for this, you can ignore this email and your password will stay the same.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111827">
        <h2 style="margin:0 0 16px">Reset your password</h2>
        <p>Hello ${safeName},</p>
        <p>We received a request to reset your TailorPro password. Click the button below to choose a new one.
           This link expires in ${RESET_MINUTES} minutes.</p>
        <p style="margin:28px 0">
          <a href="${safeLink}" style="background:#111827;color:#ffffff;padding:14px 24px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block">Reset password</a>
        </p>
        <p style="font-size:13px;color:#6b7280">Or paste this link into your browser:<br>${safeLink}</p>
        <p style="font-size:13px;color:#6b7280">If you didn't ask for this, you can ignore this email and your password will stay the same.</p>
      </div>`
  };
};

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

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!email || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const user = await User.findOne({ email }).select('+passwordResetExpires');

    // Admin accounts can't use self-service reset (use scripts/seedAdmin.js). Suspended accounts can't either.
    const eligible = Boolean(user) && user.role !== 'admin' && !user.isSuspended;

    // Cooldown: skip if a link was already sent in the last minute (stops email flooding)
    const requestedJustNow =
      eligible &&
      user.passwordResetExpires &&
      user.passwordResetExpires.getTime() > Date.now() + (RESET_MINUTES - 1) * 60 * 1000;

    if (eligible && !requestedJustNow) {
      const token = crypto.randomBytes(32).toString('hex');

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordResetToken: hashToken(token),
            passwordResetExpires: new Date(Date.now() + RESET_MINUTES * 60 * 1000)
          }
        }
      );

      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
      const link = `${frontendUrl}/reset-password/${token}`;

      try {
        if (!process.env.BREVO_API_KEY && process.env.NODE_ENV !== 'production') {
          // Local testing without an email account: the link is printed here instead
          console.log(`[Dev] Password reset link for ${email}: ${link}`);
        } else {
          const message = buildResetEmail(user.fullName, link);
          await sendEmail({ to: user.email, ...message });
        }
      } catch (mailError) {
        console.error('PASSWORD RESET EMAIL ERROR:', mailError.response?.data || mailError.message);
        // The link never reached the user, so don't leave a live token behind
        await User.updateOne(
          { _id: user._id },
          { $unset: { passwordResetToken: 1, passwordResetExpires: 1 } }
        );
      }
    }

    return res.status(200).json({ message: RESET_REQUESTED_MESSAGE });
  } catch (error) {
    console.error('FORGOT PASSWORD ERROR:', error);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};

// POST /api/auth/reset-password/:token
exports.resetPassword = async (req, res) => {
  try {
    const token = typeof req.params.token === 'string' ? req.params.token : '';
    const { password, confirmPassword } = req.body;

    const invalidLink = () =>
      res.status(400).json({
        error: 'This reset link is invalid or has expired. Please request a new one.',
        code: 'INVALID_TOKEN'
      });

    if (!/^[a-f0-9]{64}$/.test(token)) return invalidLink();

    if (typeof password !== 'string' || password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
      return res.status(400).json({
        error: `Password must be between ${MIN_PASSWORD} and ${MAX_PASSWORD} characters.`
      });
    }
    if (confirmPassword !== undefined && confirmPassword !== password) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const user = await User.findOne({
      passwordResetToken: hashToken(token),
      passwordResetExpires: { $gt: new Date() }
    });
    if (!user) return invalidLink();

    user.password = password; // hashed by the pre('save') hook
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    // Signs out every session that started before this moment (checked in the protect middleware)
    user.passwordChangedAt = new Date(Date.now() - 1000);
    await user.save();

    return res.status(200).json({
      message: 'Your password has been updated. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('RESET PASSWORD ERROR:', error);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
