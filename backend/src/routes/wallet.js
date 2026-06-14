const express = require('express');
const { createCheckoutSession, handleStripeWebhook, withdraw, getBalance } = require('../controllers/walletController');
const { protect } = require('../middleware/auth');
const router = express.Router();

router.get('/balance', protect, getBalance);
router.post('/withdraw', protect, withdraw);

// Stripe Deposits
router.post('/create-checkout-session', protect, createCheckoutSession);

// Stripe Webhook (Must be before general json parser in index.js or handled specifically)
// Since we're in a router, we'll handle the raw parsing in index.js for this specific path
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

module.exports = router;
