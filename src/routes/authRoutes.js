const router = require('express').Router();
const controller = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
router.post('/signup', controller.signup);
router.post('/login', controller.login);
router.get('/profile', requireAuth, controller.getProfile);
router.put('/profile', requireAuth, controller.updateProfile);
module.exports = router;
