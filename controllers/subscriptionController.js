const User = require('../models/User');
const axios = require('axios');

exports.initializePayment = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const amount = 350000; // ₦3,500 in kobo

    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: user.email,
        amount: amount,
        callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`,
        metadata: { userId: user._id.toString() }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
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
  console.log('--- VERIFY PAYMENT HIT ---');
  console.log('Reference received from frontend:', req.body.reference);

  try {
    const { reference } = req.body;
    if (!reference) {
      console.log('No reference provided');
      return res.status(400).json({ error: 'Transaction reference is required.' });
    }

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );

    const paymentData = response.data.data;
    console.log('Paystack Payment Status:', paymentData.status);

    if (paymentData.status === 'success') {
      // FIX: Use the securely authenticated user's ID directly!
      const userId = req.user._id; 
      
      if (!userId) {
         console.log('No logged-in user found for this request');
         return res.status(404).json({ error: 'User session not found.' });
      }

      const user = await User.findById(userId);
      if (!user) {
        console.log('User not found in DB:', userId);
        return res.status(404).json({ error: 'User account not found.' });
      }

      // Upgrade user
      user.plan = 'pro';
      user.subscriptionStatus = 'active';
      user.subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await user.save();

      console.log('User upgraded successfully:', user.email);
      return res.status(200).json({ message: 'Account successfully upgraded to PRO!' });
    } else {
      console.log('Payment not successful according to Paystack');
      return res.status(400).json({ error: 'Payment was not successful.' });
    }
  } catch (error) {
    console.error('Verify Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Server error while verifying payment.' });
  }
};
