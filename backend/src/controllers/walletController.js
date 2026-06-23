// Wallet controller for fetching futures balances from CoinDCX
const axios = require('axios');
const crypto = require('crypto');

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

const getBalance = async (req, res) => {
  try {
    const balances = await getFuturesBalances();
    const inrBalance = balances.INR || 0;
    const usdtBalance = balances.USDT || 0;
    const usdtInrRate = await getTicker('USDTINR');
    const totalBalanceInr = Math.round((inrBalance + (usdtBalance * usdtInrRate)) * 100) / 100; // Keep 2 decimal places
    // Total profit: we don't have historical baseline, so assume 0 for now
    const totalProfit = 0;
    res.json({ 
      balance: totalBalanceInr, 
      totalProfit: totalProfit, 
      transactions: [] // No transaction history
    });
  } catch (err) {
    console.error('Error fetching balance:', err.message);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getBalance };
