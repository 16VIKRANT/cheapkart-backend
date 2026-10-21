const router = require('express').Router();
const controller = require('../controllers/productController');
const { requireAuth } = require('../middleware/auth');
router.get('/', controller.listProducts);
router.post('/:id/notify', requireAuth, controller.notifyWhenAvailable);
router.get('/:id', controller.getProduct);
module.exports = router;
