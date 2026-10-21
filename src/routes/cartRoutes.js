const router = require('express').Router();
const controller = require('../controllers/cartController');
const { requireAuth } = require('../middleware/auth');
router.get('/', requireAuth, controller.getCart);
router.post('/', requireAuth, controller.updateCart);
module.exports = router;
