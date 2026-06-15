require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
require('./config/passport'); // Import passport config
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const tradeRoutes = require('./routes/trade');
const tradingService = require('./services/tradingService');

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Logging middleware for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Stripe Webhook needs raw body before express.json()
app.use('/api/wallet/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

// Session middleware (required for passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'apex_trading_session_secret',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/trades', tradeRoutes);

app.get('/', (req, res) => {
  res.send('CoinDCX Trading API is running...');
});

// Start Trading Engine
tradingService.start();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
