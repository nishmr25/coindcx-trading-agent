const express = require('express');
const { getBalance } = require('../controllers/walletController');
const router = express.Router();

router.get('/balance', getBalance);

module.exports = router;
