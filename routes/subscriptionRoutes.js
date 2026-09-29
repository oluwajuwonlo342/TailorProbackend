const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { initializePayment, verifyPayment } = require('../controllers/subscriptionController');

router.post('/initialize', protect, initializePayment);
router.post('/verify', protect, verifyPayment);

module.exports = router;