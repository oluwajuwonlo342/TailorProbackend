const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const { authAdmin } = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Measurement = require('../models/Measurement');
const Portfolio = require('../models/Portfolio');
const { PRO_PRICE_NAIRA, SUBSCRIPTION_DAYS } = require('../config/plans');
const { getPlanLabel, withPlanLabel, getCounts, getRecentTailors } = require('../utils/adminStats');

const DAY_MS = 24 * 60 * 60 * 1000;

// Public Admin Login Route (POST /api/admin/login)
router.post('/login', authAdmin);

// ==========================================
// EVERYTHING BELOW REQUIRES A LOGGED-IN ADMIN
// ==========================================
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied.' });
  }
  next();
};
router.use(protect, adminOnly);

// GET /api/admin/dashboard-stats
router.get('/dashboard-stats', async (req, res) => {
  try {
    const [counts, recentTailors] = await Promise.all([getCounts(), getRecentTailors(5)]);

    res.status(200).json({
      totalTailors: counts.totalTailors,
      activeSubscriptions: counts.proTailors,
      revenue: counts.mrr,
      collectedThisMonth: counts.collectedThisMonth,
      recentTailors
    });
  } catch (error) {
    console.error('Admin Dashboard Stats Error:', error);
    res.status(500).json({ error: 'Server error while fetching admin statistics.' });
  }
});

// GET /api/admin/overview
router.get('/overview', async (req, res) => {
  try {
    const [counts, recentTailors] = await Promise.all([getCounts(), getRecentTailors(5)]);

    res.status(200).json({
      metrics: {
        totalTailors: counts.totalTailors,
        proTailors: counts.proTailors,
        mrr: counts.mrr,
        collectedThisMonth: counts.collectedThisMonth
      },
      recentTailors
    });
  } catch (error) {
    console.error('Fetch Overview Error:', error);
    res.status(500).json({ error: 'Server error while fetching overview data.' });
  }
});

// GET /api/admin/tailors - Fetch all tailors for management
router.get('/tailors', async (req, res) => {
  try {
    const tailors = await User.find({ role: 'user' })
      .sort({ createdAt: -1 })
      .select('-password')
      .lean();

    // Every tailor carries the same planLabel (PRO / TRIAL / FREE) the other admin pages show
    res.status(200).json(withPlanLabel(tailors));
  } catch (error) {
    console.error('Fetch Tailors Error:', error);
    res.status(500).json({ error: 'Server error while fetching tailors.' });
  }
});

// GET /api/admin/tailors/:id - Fetch specific tailor details and real stats
router.get('/tailors/:id', async (req, res) => {
  try {
    const tailor = await User.findById(req.params.id).select('-password').lean();
    if (!tailor) {
      return res.status(404).json({ error: 'Tailor account not found.' });
    }

    const [totalCustomers, totalOrders] = await Promise.all([
      Customer.countDocuments({ user: tailor._id }),
      Order.countDocuments({ user: tailor._id })
    ]);

    res.status(200).json({
      tailor: { ...tailor, planLabel: getPlanLabel(tailor) },
      stats: { totalCustomers, totalOrders }
    });
  } catch (error) {
    console.error('Fetch Tailor Profile Error:', error);
    res.status(500).json({ error: 'Server error while fetching tailor profile.' });
  }
});

// DELETE /api/admin/tailors/:id - Delete a tailor and all of their data
router.delete('/tailors/:id', async (req, res) => {
  try {
    const tailor = await User.findById(req.params.id);
    if (!tailor) {
      return res.status(404).json({ error: 'Tailor account not found.' });
    }
    if (tailor.role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete another administrator account.' });
    }

    // Remove their data first so nothing is left behind. Payment records are kept for accounting.
    await Promise.all([
      Customer.deleteMany({ user: tailor._id }),
      Order.deleteMany({ user: tailor._id }),
      Measurement.deleteMany({ user: tailor._id }),
      Portfolio.deleteMany({ user: tailor._id })
    ]);
    await User.findByIdAndDelete(tailor._id);

    res.status(200).json({ message: 'Tailor successfully removed from the platform.' });
  } catch (error) {
    console.error('Delete Tailor Error:', error);
    res.status(500).json({ error: 'Server error while deleting tailor.' });
  }
});

// PUT /api/admin/tailors/:id/suspend - Toggle account suspension
router.put('/tailors/:id/suspend', async (req, res) => {
  try {
    const tailor = await User.findById(req.params.id);
    if (!tailor) {
      return res.status(404).json({ error: 'Tailor account not found.' });
    }
    if (tailor.role === 'admin') {
      return res.status(403).json({ error: 'Cannot suspend an administrator account.' });
    }

    tailor.isSuspended = !tailor.isSuspended;
    await tailor.save();

    res.status(200).json({
      message: `Account successfully ${tailor.isSuspended ? 'suspended' : 'reactivated'}.`,
      isSuspended: tailor.isSuspended
    });
  } catch (error) {
    console.error('Suspend Tailor Error:', error);
    res.status(500).json({ error: 'Server error while updating tailor status.' });
  }
});

// PUT /api/admin/tailors/:id/reset-password - Generate and apply a new password
router.put('/tailors/:id/reset-password', async (req, res) => {
  try {
    const tailor = await User.findById(req.params.id);
    if (!tailor) {
      return res.status(404).json({ error: 'Tailor account not found.' });
    }
    if (tailor.role === 'admin') {
      return res.status(403).json({ error: 'Cannot reset an administrator password from here.' });
    }

    // 12 random characters. Assign it as plain text: the User model's pre('save') hook
    // hashes it. (Hashing here as well meant it was hashed twice and could never log in.)
    const generatedPassword = crypto.randomBytes(9).toString('base64url');
    tailor.password = generatedPassword;
    await tailor.save();

    res.set('Cache-Control', 'no-store');
    res.status(200).json({
      message: 'Password reset successfully.',
      newPassword: generatedPassword
    });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ error: 'Server error while resetting password.' });
  }
});

// GET /api/admin/subscriptions - Fetch subscription metrics and every tailor's plan
router.get('/subscriptions', async (req, res) => {
  try {
    const now = new Date();
    const [counts, tailors] = await Promise.all([
      getCounts(now),
      User.find({ role: 'user' })
        .select('fullName email businessName plan subscriptionStatus trialEnd subscriptionEnd createdAt')
        .sort({ createdAt: -1 })
        .lean()
    ]);

    // PRO first, then trials, then free (newest first within each group)
    const order = { PRO: 0, TRIAL: 1, FREE: 2 };
    const subscribers = withPlanLabel(tailors, now).sort(
      (a, b) => order[a.planLabel] - order[b.planLabel]
    );

    res.status(200).json({
      metrics: {
        totalPro: counts.proTailors,
        totalFree: counts.totalTailors - counts.proTailors,
        proPrice: PRO_PRICE_NAIRA,
        monthlyRevenue: counts.mrr
      },
      subscribers
    });
  } catch (error) {
    console.error('Fetch Subscriptions Error:', error);
    res.status(500).json({ error: 'Server error while fetching subscription data.' });
  }
});

// PUT /api/admin/subscriptions/:id/toggle - Manually grant or revoke PRO status
router.put('/subscriptions/:id/toggle', async (req, res) => {
  try {
    const tailor = await User.findById(req.params.id);
    if (!tailor) {
      return res.status(404).json({ error: 'Tailor not found.' });
    }
    if (tailor.role === 'admin') {
      return res.status(403).json({ error: 'Administrator accounts do not have a plan.' });
    }

    // Decide by what the admin pages show (dates included), so the button always matches the label
    if (getPlanLabel(tailor) === 'PRO') {
      tailor.plan = 'free';
      tailor.subscriptionStatus = 'free';
      tailor.subscriptionEnd = undefined;
    } else {
      // Optional { "days": n } in the request body; defaults to one billing period
      const days = Math.min(Math.max(Number(req.body?.days) || SUBSCRIPTION_DAYS, 1), 365);
      tailor.plan = 'pro';
      tailor.subscriptionStatus = 'active';
      // An end date means the account expires normally and the 5-day reminder works
      tailor.subscriptionEnd = new Date(Date.now() + days * DAY_MS);
    }

    await tailor.save();

    res.status(200).json({
      message: 'Subscription updated successfully.',
      plan: tailor.plan,
      subscriptionStatus: tailor.subscriptionStatus,
      subscriptionEnd: tailor.subscriptionEnd,
      planLabel: getPlanLabel(tailor)
    });
  } catch (error) {
    console.error('Toggle Subscription Error:', error);
    res.status(500).json({ error: 'Server error while updating subscription.' });
  }
});

// PUT /api/admin/settings/profile - Update Super Admin credentials
router.put('/settings/profile', async (req, res) => {
  try {
    const admin = await User.findById(req.user._id);
    if (!admin) {
      return res.status(404).json({ error: 'Admin account not found.' });
    }

    const fullName = typeof req.body.fullName === 'string' ? req.body.fullName.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (fullName) admin.fullName = fullName;
    if (email) {
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }
      admin.email = email;
    }
    if (password) {
      if (password.length < 8 || password.length > 72) {
        return res.status(400).json({ error: 'Password must be between 8 and 72 characters.' });
      }
      admin.password = password; // hashed by the pre('save') hook
    }

    await admin.save();

    res.status(200).json({
      message: 'Admin profile updated successfully.',
      admin: {
        _id: admin._id,
        fullName: admin.fullName,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Update Admin Profile Error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'That email is already in use.' });
    }
    res.status(500).json({ error: 'Server error while updating profile.' });
  }
});

module.exports = router;
