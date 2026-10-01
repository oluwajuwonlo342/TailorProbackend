const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  verifyPublicLink,
  submitPublicMeasurement,
  getCustomerMeasurements,
  saveCustomerMeasurements,
  updateCustomerMeasurement,
} = require('../controllers/measurementController');

// ==========================================================
// 1. PUBLIC ROUTES (MUST GO BEFORE THE PROTECT MIDDLEWARE)
// ==========================================================

router.get('/public/:token', verifyPublicLink);
router.post('/public/:token', submitPublicMeasurement);

// ==========================================================
// 2. AUTH MIDDLEWARE (LOCKS DOWN EVERYTHING BELOW THIS LINE)
// ==========================================================
router.use(protect);

// ==========================================================
// 3. SECURE DASHBOARD ROUTES
// ==========================================================

router.get('/customer/:customerId', getCustomerMeasurements);
router.post('/customer/:customerId', saveCustomerMeasurements);
router.put('/:measurementId', updateCustomerMeasurement);

module.exports = router;
