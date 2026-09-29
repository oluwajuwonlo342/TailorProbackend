const Order = require('../models/Order');
const Customer = require('../models/Customer');

// Get all orders for the logged-in user
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('customer', 'fullName phone gender')
      .sort('dueDate');

    res.status(200).json({
      status: 'success',
      results: orders.length,
      data: orders
    });
  } catch (error) {
    console.error("GET ORDERS ERROR:", error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// Create a new order
exports.createOrder = async (req, res) => {
  try {
    const { customerId, subProfileId, outfitName, fabricDescription, totalAmount, amountPaid, dueDate, notes } = req.body;

    const customer = await Customer.findOne({ _id: customerId, user: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const newOrder = await Order.create({
      user: req.user._id,
      customer: customerId,
      subProfileId: subProfileId || null,
      outfitName,
      fabricDescription,
      totalAmount,
      amountPaid: amountPaid || 0,
      dueDate,
      notes
    });

    res.status(201).json({
      status: 'success',
      data: newOrder
    });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);
    res.status(400).json({ error: error.message || 'Failed to create order.' });
  }
};

// Update order status or payment
exports.updateOrder = async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    res.status(200).json({
      status: 'success',
      data: order
    });
  } catch (error) {
    console.error("UPDATE ORDER ERROR:", error);
    res.status(500).json({ error: 'Server Error' });
  }
};

// Delete an order
exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    res.status(200).json({ status: 'success', data: null });
  } catch (error) {
    console.error("DELETE ORDER ERROR:", error);
    res.status(500).json({ error: 'Server Error' });
  }
};