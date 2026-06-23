const express = require('express');
const { getTrades } = require('../controllers/tradeController');
const { protect } = require('../middleware/auth');
const router = express.Router();

router.get('/', getTrades);

module.exports = router;
