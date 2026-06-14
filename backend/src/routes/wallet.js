const express = require('express');
const { deposit, withdraw, getBalance } = require('../controllers/walletController');
const { protect } = require('../middleware/auth');
const router = express.Router();

router.get('/balance', protect, getBalance);
router.post('/deposit', protect, deposit);
router.post('/withdraw', protect, withdraw);

module.exports = router;
