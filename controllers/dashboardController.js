const Customer = require('../models/Customer');
const Order = require('../models/Order');

exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user._id;

    // Fetch counts and metrics for the logged-in user
    const totalCustomers = await Customer.countDocuments({ user: userId });
    const activeOrders = await Order.countDocuments({ user: userId, status: { $in: ['Pending', 'In Progress'] } });
    const pendingOrders = await Order.countDocuments({ user: userId, status: 'Pending' });
    const completedOrders = await Order.countDocuments({ user: userId, status: 'Completed' });

    // Calculate revenue and outstanding payments from orders
    const orders = await Order.find({ user: userId });
    
    let totalRevenue = 0;
    let outstandingPayments = 0;

    orders.forEach(order => {
      totalRevenue += order.amountPaid || 0;
      outstandingPayments += order.balance || 0;
    });

    // Fetch recent orders & customers for quick view
    const recentOrders = await Order.find({ user: userId }).populate('customer', 'fullName phone').sort('-createdAt').limit(5);
    const recentCustomers = await Customer.find({ user: userId }).sort('-createdAt').limit(5);

    res.status(200).json({
      status: 'success',
      data: {
        metrics: {
          totalCustomers,
          activeOrders,
          pendingOrders,
          completedOrders,
          totalRevenue,
          outstandingPayments
        },
        recentOrders,
        recentCustomers
      }
    });
  } catch (error) {
    console.error("DASHBOARD STATS ERROR:", error);
    res.status(500).json({ error: 'Server Error' });
  }
};