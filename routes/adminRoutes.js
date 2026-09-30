const express = require('express');
const router = express.Router();
const { authAdmin } = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const User = require('../models/User'); // Import the User model
const Customer = require('../models/Customer'); // Add this
const Order = require('../models/Order');
const bcrypt = require('bcryptjs'); // or 'bcrypt' depending on what you installed
const crypto = require('crypto');
// Public Admin Login Route (POST /api/admin/login)
router.post('/login', authAdmin);


// ==========================================
// PROTECTED ADMIN ROUTES (Require Admin Token)
// ==========================================
router.get('/dashboard-stats', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const totalTailors = await User.countDocuments({ role: 'user' });
    const activeSubscriptions = await User.countDocuments({ subscriptionStatus: 'pro' });
    
    const PRO_PLAN_PRICE = 3500;
    const revenue = activeSubscriptions * PRO_PLAN_PRICE;

    // NEW: Fetch the 5 most recently registered tailors
    const recentTailors = await User.find({ role: 'user' })
      .sort({ createdAt: -1 }) // Sort by newest first
      .limit(5)
      .select('fullName businessName email createdAt subscriptionStatus'); // Only grab what we need

    res.status(200).json({
      totalTailors,
      activeSubscriptions,
      revenue,
      recentTailors // Send the array to the frontend
    });
  } catch (error) {
    console.error('Admin Dashboard Stats Error:', error);
    res.status(500).json({ error: 'Server error while fetching admin statistics.' });
  }
});

// GET /api/admin/tailors - Fetch all tailors for management
router.get('/tailors', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Fetch all users with the role of 'user' (tailors)
    const tailors = await User.find({ role: 'user' })
      .sort({ createdAt: -1 })
      .select('-password'); // Exclude passwords for security

    res.status(200).json(tailors);
  } catch (error) {
    console.error('Fetch Tailors Error:', error);
    res.status(500).json({ error: 'Server error while fetching tailors.' });
  }
});

// DELETE /api/admin/tailors/:id - Delete a tailor permanently
router.delete('/tailors/:id', protect, async (req, res) => {
  try {
    // 1. Verify SAAS Admin status
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const tailorId = req.params.id;
    const tailor = await User.findById(tailorId);

    // 2. Validate tailor exists
    if (!tailor) {
      return res.status(404).json({ error: 'Tailor account not found.' });
    }

    // 3. Prevent deleting other SAAS administrators
    if (tailor.role === 'admin') {
      return res.status(403).json({ error: 'Cannot delete another administrator account.' });
    }

    // 4. Execute deletion
    await User.findByIdAndDelete(tailorId);
    
    res.status(200).json({ message: 'Tailor successfully removed from the platform.' });
  } catch (error) {
    console.error('Delete Tailor Error:', error);
    res.status(500).json({ error: 'Server error while deleting tailor.' });
  }
});

// GET /api/admin/tailors/:id - Fetch specific tailor details and real stats
router.get('/tailors/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const tailor = await User.findById(req.params.id).select('-password');
    
    if (!tailor) {
      return res.status(404).json({ error: 'Tailor account not found.' });
    }

    // Replace the placeholders by dynamically counting the real documents.
    // Note: If your schemas use a different field name linking them to the tailor 
    // (like 'tailorId' instead of 'user'), update the field name below!
    const totalCustomers = await Customer.countDocuments({ user: tailor._id });
    const totalOrders = await Order.countDocuments({ user: tailor._id });

    res.status(200).json({
      tailor,
      stats: {
        totalCustomers,
        totalOrders
      }
    });
  } catch (error) {
    console.error('Fetch Tailor Profile Error:', error);
    res.status(500).json({ error: 'Server error while fetching tailor profile.' });
  }
});

// PUT /api/admin/tailors/:id/suspend - Toggle account suspension
router.put('/tailors/:id/suspend', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const tailor = await User.findById(req.params.id);
    
    if (!tailor) {
      return res.status(404).json({ error: 'Tailor account not found.' });
    }

    if (tailor.role === 'admin') {
      return res.status(403).json({ error: 'Cannot suspend an administrator account.' });
    }

    // Toggle the boolean value
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
router.put('/tailors/:id/reset-password', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const tailor = await User.findById(req.params.id);
    
    if (!tailor) {
      return res.status(404).json({ error: 'Tailor account not found.' });
    }

    if (tailor.role === 'admin') {
      return res.status(403).json({ error: 'Cannot reset an administrator password from here.' });
    }

    // 1. Generate a random 8-character hex password (e.g., 'a1b2c3d4')
    const generatedPassword = crypto.randomBytes(4).toString('hex');
    
    // 2. Hash the new password securely
    const salt = await bcrypt.genSalt(10);
    tailor.password = await bcrypt.hash(generatedPassword, salt);
    
    // 3. Save the updated user document
    await tailor.save();

    // 4. Return the plain text password so the Super Admin can copy it
    res.status(200).json({ 
      message: 'Password reset successfully.',
      newPassword: generatedPassword 
    });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ error: 'Server error while resetting password.' });
  }
});

// GET /api/admin/subscriptions - Fetch subscription metrics and user plans
router.get('/subscriptions', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // 1. Calculate metrics using the 'plan' field to match your schema
    const totalPro = await User.countDocuments({ plan: 'pro', role: 'user' });
    const totalFree = await User.countDocuments({ plan: 'free', role: 'user' });
    
    // Assuming PRO plan costs ₦5,000/month
    const PRO_PLAN_PRICE = 3500; 
    const monthlyRevenue = totalPro * PRO_PLAN_PRICE;

    // 2. Fetch the list of tailors with their correct subscription fields
    const subscribers = await User.find({ role: 'user' })
      .select('fullName email businessName plan subscriptionStatus trialEnd')
      .sort({ plan: -1, createdAt: -1 }); // Sort PRO users to the top

    res.status(200).json({
      metrics: {
        totalPro,
        totalFree,
        monthlyRevenue
      },
      subscribers
    });
  } catch (error) {
    console.error('Fetch Subscriptions Error:', error);
    res.status(500).json({ error: 'Server error while fetching subscription data.' });
  }
});

// PUT /api/admin/subscriptions/:id/toggle - Manually grant or revoke PRO status
router.put('/subscriptions/:id/toggle', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const tailor = await User.findById(req.params.id);
    if (!tailor) {
      return res.status(404).json({ error: 'Tailor not found.' });
    }

    // Toggle logic based on your schema
    if (tailor.plan === 'pro') {
      tailor.plan = 'free';
      tailor.subscriptionStatus = 'free';
    } else {
      tailor.plan = 'pro';
      tailor.subscriptionStatus = 'active';
    }

    await tailor.save();

    res.status(200).json({ 
      message: 'Subscription updated successfully.',
      plan: tailor.plan,
      subscriptionStatus: tailor.subscriptionStatus
    });
  } catch (error) {
    console.error('Toggle Subscription Error:', error);
    res.status(500).json({ error: 'Server error while updating subscription.' });
  }
});

// GET /api/admin/overview - Fetch dashboard summary and recent activity
router.get('/overview', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // 1. Calculate top-level metrics
    const totalTailors = await User.countDocuments({ role: 'user' });
    const proTailors = await User.countDocuments({ role: 'user', plan: 'pro' });
    const mrr = proTailors * 3500; // ₦5,000/month PRO plan

    // 2. Fetch the 5 most recent registrations
    const recentTailors = await User.find({ role: 'user' })
      .select('fullName email businessName plan createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      metrics: {
        totalTailors,
        proTailors,
        mrr
      },
      recentTailors
    });
  } catch (error) {
    console.error('Fetch Overview Error:', error);
    res.status(500).json({ error: 'Server error while fetching overview data.' });
  }
});

// PUT /api/admin/settings/profile - Update Super Admin credentials
router.put('/settings/profile', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const admin = await User.findById(req.user._id);
    if (!admin) {
      return res.status(404).json({ error: 'Admin account not found.' });
    }

    admin.fullName = req.body.fullName || admin.fullName;
    admin.email = req.body.email || admin.email;

    if (req.body.password) {
      admin.password = req.body.password;
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
