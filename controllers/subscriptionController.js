const User = require('../models/User');
const Payment = require('../models/Payment');
const axios = require('axios');

// CONFIRM THIS PRICE. The admin Subscriptions page currently assumes ₦3,500.
const PRO_PRICE_NAIRA = 1500;
const PRO_PRICE_KOBO = PRO_PRICE_NAIRA * 100;
const SUBSCRIPTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const paystackHeaders = () => ({
  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
});

exports.initializePayment = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: user.email,
        amount: PRO_PRICE_KOBO,
        currency: 'NGN',
        callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`,
        metadata: { userId: user._id.toString() }
      },
      { headers: { ...paystackHeaders(), 'Content-Type': 'application/json' } }
    );

    res.status(200).json({
      authorization_url: response.data.data.authorization_url,
      reference: response.data.data.reference,
      email: user.email
    });
  } catch (error) {
    console.error('Initialize Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to initialize payment.' });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const reference =
      typeof req.body.reference === 'string' ? req.body.reference.trim() : '';
    if (!reference) {
      return res.status(400).json({ error: 'Transaction reference is required.' });
    }

    // 1. Has this reference already been used?
    const existing = await Payment.findOne({ reference });
    if (existing) {
      if (String(existing.user) !== String(req.user._id)) {
        return res.status(403).json({ error: 'This payment reference belongs to another account.' });
      }
      return res.status(200).json({
        message: 'This payment has already been applied to your account.',
        alreadyApplied: true
      });
    }

    // 2. Ask Paystack about it
    let paymentData;
    try {
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: paystackHeaders() }
      );
      paymentData = response.data.data;
    } catch (err) {
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        return res.status(400).json({ error: 'Could not verify this payment reference.' });
      }
      throw err;
    }

    if (paymentData.status !== 'success') {
      return res.status(400).json({ error: 'Payment was not successful.' });
    }

    // 3. Right amount and currency?
    if (paymentData.amount !== PRO_PRICE_KOBO || paymentData.currency !== 'NGN') {
      console.log(`Amount mismatch. Expected ${PRO_PRICE_KOBO} NGN, got ${paymentData.amount} ${paymentData.currency}`);
      return res.status(400).json({ error: 'Payment amount does not match the subscription price.' });
    }

    // 4. Was this payment started by the logged-in user?
    if (paymentData.metadata?.userId !== String(req.user._id)) {
      return res.status(403).json({ error: 'This payment was not made from your account.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User account not found.' });

    // 5. Renewing early extends from the current end date instead of discarding the remaining days
    const now = new Date();
    const base =
      user.plan === 'pro' && user.subscriptionEnd && user.subscriptionEnd > now
        ? user.subscriptionEnd
        : now;
    const newEnd = new Date(base.getTime() + SUBSCRIPTION_DAYS * DAY_MS);

    // 6. Record the reference first; the unique index stops two requests from both applying it
    let record;
    try {
      record = await Payment.create({
        user: user._id,
        reference,
        amount: paymentData.amount,
        currency: paymentData.currency,
        paidAt: paymentData.paid_at ? new Date(paymentData.paid_at) : now,
        periodEnd: newEnd
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(200).json({
          message: 'This payment has already been applied to your account.',
          alreadyApplied: true
        });
      }
      throw err;
    }

    // 7. Upgrade (undo the record if saving the user fails, so a retry can succeed)
    try {
      user.plan = 'pro';
      user.subscriptionStatus = 'active';
      user.subscriptionEnd = newEnd;
      await user.save();
    } catch (err) {
      await Payment.deleteOne({ _id: record._id });
      throw err;
    }

    console.log('User upgraded successfully:', user.email);
    return res.status(200).json({
      message: 'Account successfully upgraded to PRO!',
      subscriptionEnd: newEnd
    });
  } catch (error) {
    console.error('Verify Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Server error while verifying payment.' });
  }
};
