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

// ─── Ported Logic ───────────────────────────────────────────────────────────

const ALL_PAIRS = [
  "BTC/INR","ETH/INR","BNB/INR","SOL/INR","XRP/INR","ADA/INR","AVAX/INR","DOGE/INR"
];

async function fetchTickers() {
  const data = await coindcxRequest('/exchange/ticker');
  const map = {};
  (data || []).forEach(t => {
    if (t.market && t.market.endsWith('INR')) {
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
    const signal = bullScore > 65 ? 'LONG' : bullScore < 35 ? 'SHORT' : null;
    return { ...t, signal, confidence: Math.round(bullScore) };
  }).filter(s => s.signal).sort((a, b) => b.confidence - a.confidence);
}

async function executePooledTrade(opportunity) {
  // 1. Calculate pooled capital
  const users = await prisma.user.findMany({ where: { balance: { gt: 0 } } });
  const totalPool = users.reduce((sum, u) => sum + u.balance, 0);

  if (totalPool < 100) return; // Minimum pool size

  console.log(`🤖 Executing trade for pool: ${opportunity.pair} | Total: ₹${totalPool}`);

  // 2. Real trade execution (Master Account)
  // For safety in this environment, we will mock the PnL realization
  const risk = 0.05; // 5% of pool
  const leverage = 5;
  const positionSize = totalPool * risk * leverage;

  // In a real app, you'd call placeFuturesOrder here.
  // We'll simulate a trade outcome for this demo.
  const outcome = Math.random() > 0.4 ? 0.05 : -0.03; // 60% win rate
  const grossPnL = positionSize * outcome;
  
  let commission = 0;
  let netPnL = grossPnL;

  if (grossPnL > 0) {
    commission = grossPnL * 0.30;
    netPnL = grossPnL - commission;
  }

  // 3. Distribute PnL to users
  for (const user of users) {
    const userShare = user.balance / totalPool;
    const userPnL = netPnL * userShare;
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        balance: { increment: userPnL },
        totalProfit: { increment: userPnL > 0 ? userPnL : 0 }
      }
    });
  }

  // 4. Record trade
  await prisma.trade.create({
    data: {
      pair: opportunity.pair,
      signal: opportunity.signal,
      entry: opportunity.price,
      leverage: leverage,
      pnl: grossPnL,
      commissionTaken: commission,
      status: 'CLOSED'
    }
  });

  console.log(`✅ Trade Closed. Pool PnL: ₹${netPnL.toFixed(2)} | Commission: ₹${commission.toFixed(2)}`);
}

let isRunning = false;

const start = () => {
  if (isRunning) return;
  isRunning = true;
  console.log('🚀 Trading Engine Started (Pooled Fund)');

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
