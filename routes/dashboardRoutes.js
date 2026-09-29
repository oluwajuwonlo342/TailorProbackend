const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Customer = require('../models/Customer');
const Order = require('../models/Order');

// Protect all dashboard routes
router.use(protect);

// GET: Fetch real-time dashboard analytics and metrics for the logged-in user
router.get('/', async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch all customers and orders belonging to this tenant
    const customers = await Customer.find({ user: userId }).sort('-createdAt');
    const orders = await Order.find({ user: userId }).populate('customer', 'fullName phone').sort('-createdAt');

    // Calculate metrics
    const totalCustomers = customers.length;
    
    // Active orders are any order that is NOT Delivered or Cancelled
    const activeOrders = orders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').length;
    
    // Completed orders
    const completedOrders = orders.filter(o => o.status === 'Delivered').length;

    // Financial calculations with safe fallback checks for property names
    let totalRevenue = 0;
    let outstandingBalances = 0;

    orders.forEach(o => {
      const paid = Number(o.amountPaid || o.paidAmount || o.paid || 0);
      const total = Number(o.totalAmount || o.total || 0);
      
      totalRevenue += paid;
      const balance = total - paid;
      if (balance > 0) {
        outstandingBalances += balance;
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        totalCustomers,
        activeOrders,
        completedOrders,
        totalRevenue,
        outstandingBalances,
        recentOrders: orders.slice(0, 5),     // Top 5 recent orders
        recentCustomers: customers.slice(0, 5) // Top 5 recent customers
      }
    });
  } catch (error) {
    console.error("DASHBOARD STATS ERROR:", error);
    res.status(500).json({ error: 'Server Error' });
  }
});

module.exports = router;