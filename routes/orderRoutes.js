const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const requirePro = require('../middleware/requirePro');
const { getOrders, createOrder, updateOrder, deleteOrder } = require('../controllers/orderController');

router.use(protect);
router.use(requirePro);

router.route('/')
  .get(getOrders)
  .post(createOrder);

router.route('/:id')
  .put(updateOrder)
  .delete(deleteOrder);

module.exports = router;
