const crypto = require('crypto');
const Order = require('../models/Order');
const Customer = require('../models/Customer');

// Must match the statuses on the Orders page (and the dashboard counts)
const ORDER_STATUSES = ['Pending', 'In Production', 'Ready for Fitting', 'Delivered', 'Cancelled'];
const MAX_AMOUNT = 100000000; // ₦100 million, a sanity ceiling
const POPULATE_CUSTOMER = 'fullName phone gender';

const cleanText = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// Accepts numbers or numeric strings. Returns null when it isn't a valid, non-negative amount.
const toAmount = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) return null;
  return Math.round(n * 100) / 100;
};

const toDate = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Random, so two orders can't share a number
const generateOrderNumber = () => `ORD-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

const handleError = (res, error, label, fallback) => {
  console.error(`${label}:`, error);
  if (error.name === 'ValidationError') {
    return res.status(400).json({ error: Object.values(error.errors).map((e) => e.message).join(' ') });
  }
  if (error.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid ID supplied.' });
  }
  if (error.code === 11000) {
    return res.status(409).json({ error: 'That order already exists. Please try again.' });
  }
  return res.status(500).json({ error: fallback });
};

// Get all orders for the logged-in user
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('customer', POPULATE_CUSTOMER)
      .sort('dueDate');

    res.status(200).json({ status: 'success', results: orders.length, data: orders });
  } catch (error) {
    handleError(res, error, 'GET ORDERS ERROR', 'Server Error');
  }
};

// Create an order
exports.createOrder = async (req, res) => {
  try {
    const { customerId, subProfileId, outfitName, fabricDescription, totalAmount, amountPaid, dueDate, notes } = req.body;

    if (typeof customerId !== 'string' || !customerId) {
      return res.status(400).json({ error: 'Please choose a customer.' });
    }

    const name = cleanText(outfitName, 120);
    if (!name) {
      return res.status(400).json({ error: 'Please enter the outfit name.' });
    }

    const total = toAmount(totalAmount);
    if (total === null) {
      return res.status(400).json({ error: 'Please enter a valid total amount.' });
    }

    const noPayment = amountPaid === undefined || amountPaid === null || amountPaid === '';
    const paid = noPayment ? 0 : toAmount(amountPaid);
    if (paid === null) {
      return res.status(400).json({ error: 'Please enter a valid amount paid.' });
    }
    if (paid > total) {
      return res.status(400).json({ error: 'Amount paid cannot be more than the total amount.' });
    }

    const due = toDate(dueDate);
    if (!due) {
      return res.status(400).json({ error: 'Please choose a valid due date.' });
    }

    const customer = await Customer.findOne({ _id: customerId, user: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    // A family member must belong to this customer
    let subId = null;
    if (subProfileId) {
      if (typeof subProfileId !== 'string' || !customer.subProfiles.id(subProfileId)) {
        return res.status(400).json({ error: 'That family member was not found for this customer.' });
      }
      subId = subProfileId;
    }

    const newOrder = await Order.create({
      user: req.user._id,
      customer: customer._id,
      subProfileId: subId,
      orderNumber: generateOrderNumber(),
      outfitName: name,
      fabricDescription: cleanText(fabricDescription, 300),
      totalAmount: total,
      amountPaid: paid,
      dueDate: due,
      notes: cleanText(notes, 1000)
    });

    await newOrder.populate('customer', POPULATE_CUSTOMER);

    res.status(201).json({ status: 'success', data: newOrder });
  } catch (error) {
    handleError(res, error, 'CREATE ORDER ERROR', 'Failed to create order.');
  }
};

// Update order details, status or payment
exports.updateOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Only these fields can be changed. user, customer and orderNumber are never taken from the request.
    const { outfitName, fabricDescription, totalAmount, amountPaid, dueDate, notes, status } = req.body;

    if (outfitName !== undefined) {
      const name = cleanText(outfitName, 120);
      if (!name) {
        return res.status(400).json({ error: 'Outfit name cannot be empty.' });
      }
      order.outfitName = name;
    }
    if (fabricDescription !== undefined) order.fabricDescription = cleanText(fabricDescription, 300);
    if (notes !== undefined) order.notes = cleanText(notes, 1000);

    if (dueDate !== undefined) {
      const due = toDate(dueDate);
      if (!due) {
        return res.status(400).json({ error: 'Please choose a valid due date.' });
      }
      order.dueDate = due;
    }

    let total = order.totalAmount;
    let paid = order.amountPaid || 0;
    if (totalAmount !== undefined) {
      total = toAmount(totalAmount);
      if (total === null) {
        return res.status(400).json({ error: 'Please enter a valid total amount.' });
      }
    }
    if (amountPaid !== undefined) {
      paid = toAmount(amountPaid);
      if (paid === null) {
        return res.status(400).json({ error: 'Please enter a valid amount paid.' });
      }
    }
    if (paid > total) {
      return res.status(400).json({ error: 'Amount paid cannot be more than the total amount.' });
    }
    order.totalAmount = total;
    order.amountPaid = paid;

    if (status !== undefined) {
      if (!ORDER_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid order status.' });
      }
      const balance = total - paid;
      if (status === 'Delivered' && balance > 0) {
        return res.status(400).json({
          error: `Cannot mark this order as Delivered yet. There is still an outstanding balance of ₦${balance.toLocaleString()}. Please record full payment first.`
        });
      }
      order.status = status;
    }

    await order.save();
    // Keep the customer's name and phone in the response so the Orders page doesn't lose them
    await order.populate('customer', POPULATE_CUSTOMER);

    res.status(200).json({ status: 'success', data: order });
  } catch (error) {
    handleError(res, error, 'UPDATE ORDER ERROR', 'Server Error');
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
    handleError(res, error, 'DELETE ORDER ERROR', 'Server Error');
  }
};
