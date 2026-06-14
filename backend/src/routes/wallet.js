const express = require('express');
const { createCheckoutSession, handleStripeWebhook, withdraw, getBalance } = require('../controllers/walletController');
const { protect } = require('../middleware/auth');
const router = express.Router();

router.get('/balance', protect, getBalance);
router.post('/withdraw', protect, withdraw);

// Stripe Deposits
router.post('/create-checkout-session', protect, createCheckoutSession);

// Stripe Webhook (Parser handled in index.js)
router.post('/webhook', handleStripeWebhook);

module.exports = router;
