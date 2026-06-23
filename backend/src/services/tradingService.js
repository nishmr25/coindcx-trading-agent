// Trading service for executing trades on CoinDCX Futures
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const crypto = require('crypto');

const prisma = new PrismaClient();

const COINDCX_API_KEY = process.env.COINDCX_API_KEY;
const COINDCX_API_SECRET = process.env.COINDCX_API_SECRET;

async function hmacSHA256(secret, message) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

async function coindcxRequest(path, body = null) {
  const url = `https://api.coindcx.com${path}`;
  const method = body ? 'POST' : 'GET';
  const timestamp = Date.now();
  const timeBody = body ? JSON.stringify({ ...body, timestamp }) : null;
  const signature = timeBody ? await hmacSHA256(COINDCX_API_SECRET, timeBody) : null;

  const headers = { 'Content-Type': 'application/json' };
  if (COINDCX_API_KEY) {
    headers['X-AUTH-APIKEY'] = COINDCX_API_KEY;
    headers['X-AUTH-SIGNATURE'] = signature;
  }

  try {
    const res = await axios({
      method,
      url,
      headers,
      data: timeBody,
    });
    return res.data;
  } catch (err) {
    console.error(`CoinDCX Error (${path}):`, err.response?.data || err.message);
    throw new Error(err.response?.data?.message || 'CoinDCX API Error');
  }
}

// Fetch futures balances for INR and USDT wallets
async function getFuturesBalances() {
  try {
    const data = await coindcxRequest('/futures/balances');
    const balances = {};
    (data || []).forEach(item => {
      if (item.currency) {
        balances[item.currency.toUpperCase()] = parseFloat(item.balance) || 0;
      }
    });
    return balances;
  } catch (err) {
    console.error('Failed to fetch futures balances:', err.message);
    return { INR: 0, USDT: 0 };
  }
}

// Get ticker price for a given market (e.g., BTCINR)
async function getTicker(market) {
  try {
    const data = await coindcxRequest('/exchange/ticker');
    const ticker = (data || []).find(t => t.market === market);
    return ticker ? parseFloat(ticker.last_price) : 0;
  } catch (err) {
    console.error(`Failed to fetch ticker for ${market}:`, err.message);
    return 0;
  }
}

// Place a futures market order
async function placeFuturesOrder(pair, side, quantity) {
  try {
    // Note: Adjust quantity formatting according to contract specifications if needed
    const order = {
      pair: pair,
      side: side.toLowerCase(),
      order_type: 'market',
      quantity: quantity.toString(),
      // leverage can be added if needed
    };
    const result = await coindcxRequest('/futures/place_order', order);
    console.log(`Order placed successfully: ${JSON.stringify(result)}`);
    return result;
  } catch (err) {
    console.error('Failed to place order:', err.message);
    throw err;
  }
}

// Trading pairs we consider
const ALL_PAIRS = [
  "BTC/INR","ETH/INR","BNB/INR","SOL/INR","XRP/INR","ADA/INR","AVAX/INR","DOGE/INR"
];

async function fetchTickers() {
  const data = await coindcxRequest('/exchange/ticker');
  const map = {};
  (data || []).forEach(t => {
    if (t.market && t.marker.endsWith('INR')) {
      const pair = t.market.replace('INR', '') + '/INR';
      if (ALL_PAIRS.includes(pair)) {
        map[pair] = {
          pair,
          price: parseFloat(t.last_price || 0),
          change24h: parseFloat(t.change_24_hour || 0),
          rsi: 50 + (parseFloat(t.change_24_hour || 0) * 2), // Mocked RSI
          macd: parseFloat(t.change_24_hour || 0) > 1 ? 'bullish_cross' : 'neutral',
        };
      }
    }
  });
  return Object.values(map);
}

function analyseMarket(tickers) {
  return tickers.map(t => {
    const bullScore = 50 + (t.change24h * 5);
    const signal = bullScore > 65 ? 'LONG' : (bullScore < 35 ? 'SHORT' : null);
    return { ...t, signal, confidence: Math.round(bullScore) };
  }).filter(s => s.signal).sort((a, b) => b.confidence - a.confidence);
}

async function executePooledTrade(opportunity) {
  try {
    // Get futures balances
    const balances = await getFuturesBalances();
    const inrBalance = balances.INR || 0;
    const usdtBalance = balances.USDT || 0;
    // Convert USDT to INR using ticker
    const usdtInrRate = await getTicker('USDTINR');
    const totalBalanceInr = Math.round((inrBalance + (usdtBalance * usdtInrRate)) * 100) / 100;
    
    if (totalBalanceInr < 100) {
      console.log('Insufficient balance to trade (minimum 100 INR required).');
      return;
    }

    // Risk percentage per trade (e.g., 10% of balance)
    const riskPercent = 0.10;
    const riskAmountInr = totalBalanceInr * riskPercent;
    
    // Calculate quantity based on opportunity price
    const opportunityPrice = opportunity.price; // In INR per unit of base asset
    if (opportunityPrice <= 0) {
      console.log('Invalid opportunity price.');
      return;
    }
    const quantity = riskAmountInr / opportunityPrice; // Amount of base currency (e.g., BTC)
    
    // Determine side based on signal
    const side = opportunity.signal === 'LONG' ? 'BUY' : 'SELL';
    const pair = opportunity.pair; // e.g., "BTC/INR"
    
    console.log(`\n--- Executing Trade ---`);
    console.log(`Pair: ${pair}`);
    console.log(`Signal: ${opportunity.signal} (confidence: ${opportunity.confidence}%)`);
    console.log(`Total Balance: ₹${totalBalanceInr.toFixed(2)}`);
    console.log(`Risk Amount: ₹${riskAmountInr.toFixed(2)} (${riskPercent*100}%)`);
    console.log(`Quantity: ${quantity.toFixed(6)} ${pair.split('/')[0]}`);
    console.log(`Side: ${side}`);
    console.log(`Price: ₹${opportunityPrice.toFixed(2)}`);
    console.log('----------------------\n');

    // Place the order via CoinDCX Futures API
    const orderResult = await placeFuturesOrder(pair, side, quantity);
    console.log('Trade executed via CoinDCX API.');
  } catch (err) {
    console.error('Error executing trade:', err.message);
  }
}

let isRunning = false;

const start = () => {
  if (isRunning) return;
  isRunning = true;
  console.log('🚀 Trading Engine Started (Live Futures Trading)');

  setInterval(async () => {
    try {
      const tickers = await fetchTickers();
      const signals = analyseMarket(tickers);
      if (signals.length > 0) {
        await executePooledTrade(signals[0]);
      }
    } catch (err) {
      console.error('Trading Engine Iteration Error:', err.message);
    }
  }, 60000); // Check every minute
};

module.exports = { start };
