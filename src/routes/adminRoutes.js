const router = require('express').Router();
const controller = require('../controllers/adminController');
const { requireAuth, requireAdmin } = require('../middleware/auth');
router.use(requireAuth, requireAdmin);
router.get('/orders', controller.allOrders);
router.patch('/orders/:id/status', controller.updateOrderStatus);
router.get('/inventory', controller.inventory);
router.patch('/products/:id/stock', controller.updateStock);
module.exports = router;
