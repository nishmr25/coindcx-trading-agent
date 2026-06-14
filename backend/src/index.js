require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const tradeRoutes = require('./routes/trade');
const tradingService = require('./services/tradingService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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
