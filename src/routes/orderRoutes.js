const router = require('express').Router();
const controller = require('../controllers/orderController');
const { requireAuth } = require('../middleware/auth');
router.post('/', requireAuth, controller.checkout);
router.get('/', requireAuth, controller.myOrders);
module.exports = router;
