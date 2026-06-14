import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Theme ──────────────────────────────────────────────────────────────────
const C = {
  bg:"#050810", panel:"#0b0f1e", card:"#0e1525", border:"#1a2240",
  accent:"#00f5c4", warn:"#ff6b35", bull:"#00e676",
  bear:"#ff3d57", muted:"#4a5580", text:"#cdd6f4", textDim:"#6272a4",
  live:"#00f5c4", paper:"#ff6b35",
};
const fmt  = (n,d=2)=>Number(n).toFixed(d);
const fmtP = (n)=>(n>=0?`+${fmt(n)}%`:`${fmt(n)}%`);
const inr  = (n)=>`₹${Number(n).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const usd  = (n)=>`$${Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const ago  = (ms)=>{ const s=Math.floor((Date.now()-ms)/1000); return s<60?`${s}s ago`:`${Math.floor(s/60)}m ago`; };

// ─── Constants ──────────────────────────────────────────────────────────────
const PAIRS = {
  INR: [
    "BTC/INR","ETH/INR","BNB/INR","SOL/INR","XRP/INR","ADA/INR","AVAX/INR","DOGE/INR",
    "DOT/INR","MATIC/INR","LTC/INR","LINK/INR","UNI/INR","ATOM/INR","ETC/INR","BCH/INR",
    "XLM/INR","NEAR/INR","FIL/INR","APT/INR","ARB/INR","OP/INR","SUI/INR","INJ/INR",
    "TIA/INR","SEI/INR","JTO/INR","PYTH/INR","WIF/INR","BOME/INR","PEPE/INR",
    "SHIB/INR","FLOKI/INR","BONK/INR","ORDI/INR","STX/INR","ENA/INR","ETHFI/INR",
    "NOT/INR","WLD/INR","TRX/INR","TON/INR","ICP/INR","HBAR/INR","VET/INR",
    "SAND/INR","MANA/INR","AXS/INR","GALA/INR","IMX/INR","ENS/INR","APE/INR","CRV/INR",
    "AAVE/INR","MKR/INR","COMP/INR","LDO/INR","GMX/INR","DYDX/INR","PENDLE/INR",
    "FET/INR","AGIX/INR","RENDER/INR","ARKM/INR","GMT/INR","JASMY/INR","MAGIC/INR",
    "SNX/INR","SUSHI/INR","1INCH/INR","RPL/INR","GNS/INR","FXS/INR","CVX/INR",
    "BAL/INR","KNC/INR","ZRX/INR","OCEAN/INR","CFX/INR","MEME/INR","BLUR/INR",
  ],
  USDT: [
    "BTC/USDT","ETH/USDT","BNB/USDT","SOL/USDT","XRP/USDT","ADA/USDT","AVAX/USDT","DOGE/USDT",
    "DOT/USDT","MATIC/USDT","LTC/USDT","LINK/USDT","UNI/USDT","ATOM/USDT","ETC/USDT","BCH/USDT",
    "XLM/USDT","NEAR/USDT","FIL/USDT","APT/USDT","ARB/USDT","OP/USDT","SUI/USDT","INJ/USDT",
    "TIA/USDT","SEI/USDT","JTO/USDT","PYTH/USDT","WIF/USDT","BOME/USDT","PEPE/USDT",
    "SHIB/USDT","FLOKI/USDT","BONK/USDT","ORDI/USDT","STX/USDT","ENA/USDT","ETHFI/USDT",
    "NOT/USDT","WLD/USDT","TRX/USDT","TON/USDT","ICP/USDT","HBAR/USDT","VET/USDT",
    "SAND/USDT","MANA/USDT","AXS/USDT","GALA/USDT","IMX/USDT","ENS/USDT","APE/USDT","CRV/USDT",
    "AAVE/USDT","MKR/USDT","COMP/USDT","LDO/USDT","GMX/USDT","DYDX/USDT","PENDLE/USDT",
    "FET/USDT","AGIX/USDT","RENDER/USDT","ARKM/USDT","GMT/USDT","JASMY/USDT","MAGIC/USDT",
    "SNX/USDT","SUSHI/USDT","1INCH/USDT","RPL/USDT","GNS/USDT","FXS/USDT","CVX/USDT",
    "BAL/USDT","KNC/USDT","ZRX/USDT","OCEAN/USDT","CFX/USDT","MEME/USDT","BLUR/USDT",
  ]
};

const BASE_PRICES = {
  INR: {
    "BTC/INR":5733250,"ETH/INR":324700,"BNB/INR":50830,"SOL/INR":14875,"XRP/INR":52.02,
    "ADA/INR":41.22,"AVAX/INR":3272.5,"DOGE/INR":13.77,"DOT/INR":697,"MATIC/INR":77.35,
    "LTC/INR":7607.5,"LINK/INR":1564,"UNI/INR":833,"ATOM/INR":773.5,"ETC/INR":2728.5,
    "BCH/INR":40630,"XLM/INR":9.69,"NEAR/INR":620.5,"FIL/INR":578,"APT/INR":782,
    "ARB/INR":95.2,"OP/INR":208.25,"SUI/INR":158.95,"INJ/INR":2414,"TIA/INR":952,
    "SEI/INR":44.2,"JTO/INR":272.85,"PYTH/INR":35.7,"WIF/INR":243.95,
    "BOME/INR":1.53,"PEPE/INR":0.00112,"SHIB/INR":0.0021,"FLOKI/INR":0.0168,
    "BONK/INR":0.00265,"ORDI/INR":3638,"STX/INR":196.35,"ENA/INR":83.3,"ETHFI/INR":293.25,
    "NOT/INR":0.697,"WLD/INR":481.95,"TRX/INR":10.79,"TON/INR":585.65,"ICP/INR":1122,
    "HBAR/INR":9.6,"VET/INR":3.23,"SAND/INR":39.95,"MANA/INR":35.7,"AXS/INR":756.5,
    "GALA/INR":4.08,"IMX/INR":181.9,"ENS/INR":2099.5,"APE/INR":112.2,"CRV/INR":44.2,
    "AAVE/INR":9520,"MKR/INR":241400,"COMP/INR":4955.5,"LDO/INR":158.95,"GMX/INR":2414,
    "DYDX/INR":163.2,"PENDLE/INR":372.3,"FET/INR":196.35,"AGIX/INR":74.8,"RENDER/INR":736.95,
    "ARKM/INR":151.3,"MAGIC/INR":69.7,"GMT/INR":16.15,"JASMY/INR":1.53,
  },
  USDT: {
    "BTC/USDT":67450,"ETH/USDT":3820,"BNB/USDT":598,"SOL/USDT":175,"XRP/USDT":0.612,
    "ADA/USDT":0.485,"AVAX/USDT":38.5,"DOGE/USDT":0.162,"DOT/USDT":8.2,"MATIC/USDT":0.91,
    "LTC/USDT":89.5,"LINK/USDT":18.4,"UNI/USDT":9.8,"ATOM/USDT":9.1,"ETC/USDT":32.1,
    "BCH/USDT":478,"XLM/USDT":0.114,"NEAR/USDT":7.3,"FIL/USDT":6.8,"APT/USDT":9.2,
    "ARB/USDT":1.12,"OP/USDT":2.45,"SUI/USDT":1.87,"INJ/USDT":28.4,"TIA/USDT":11.2,
    "SEI/USDT":0.52,"JTO/USDT":3.21,"PYTH/USDT":0.42,"WIF/USDT":2.87,
    "BOME/USDT":0.018,"PEPE/USDT":0.0000132,"SHIB/USDT":0.0000248,"FLOKI/USDT":0.000198,
    "BONK/USDT":0.0000312,"ORDI/USDT":42.8,"STX/USDT":2.31,"ENA/USDT":0.98,"ETHFI/USDT":3.45,
    "NOT/USDT":0.0082,"WLD/USDT":5.67,"TRX/USDT":0.127,"TON/USDT":6.89,"ICP/USDT":13.2,
    "HBAR/USDT":0.113,"VET/USDT":0.038,"SAND/USDT":0.47,"MANA/USDT":0.42,"AXS/USDT":8.9,
    "GALA/USDT":0.048,"IMX/USDT":2.14,"ENS/USDT":24.7,"APE/USDT":1.32,"CRV/USDT":0.52,
    "AAVE/USDT":112,"MKR/USDT":2840,"COMP/USDT":58.3,"LDO/USDT":1.87,"GMX/USDT":28.4,
    "DYDX/USDT":1.92,"PENDLE/USDT":4.38,"FET/USDT":2.31,"AGIX/USDT":0.88,"RENDER/USDT":8.67,
    "ARKM/USDT":1.78,"MAGIC/USDT":0.82,"GMT/USDT":0.19,"JASMY/USDT":0.018,
  }
};

// ─── CoinDCX HMAC Auth ───────────────────────────────────────────────────────
async function hmacSHA256(secret, message) {
  const enc  = new TextEncoder();
  const key  = await crypto.subtle.importKey("raw", enc.encode(secret),
    { name:"HMAC", hash:"SHA-256" }, false, ["sign"]);
  const sig  = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

async function coindcxRequest(path, apiKey, apiSecret, body=null) {
  const method  = body ? "POST" : "GET";
  const timeBody = body ? JSON.stringify({ ...body, timestamp: Date.now() }) : null;
  const signature = timeBody ? await hmacSHA256(apiSecret, timeBody) : null;

  const headers = { "Content-Type":"application/json" };
  if (apiKey) {
    headers["X-AUTH-APIKEY"]    = apiKey;
    headers["X-AUTH-SIGNATURE"] = signature;
  }

  const res = await fetch(`/api${path}`, {
    method, headers,
    body: timeBody || undefined,
  });

  if (!res.ok) {
    const txt = await res.text().catch(()=>"");
    throw new Error(`CoinDCX ${res.status}: ${txt.slice(0,200)}`);
  }
  return res.json();
}

// ─── Fetch real balances from CoinDCX ───────────────────────────────────────
async function fetchBothBalances(apiKey, apiSecret) {
  let inrBal = 0, usdtBal = 0;
  try {
    const body = { timestamp: Math.floor(Date.now() / 1000) };
    const data = await coindcxRequest("/exchange/v1/derivatives/futures/wallets", apiKey, apiSecret, body);
    const inrW = (data || []).find(w => w.currency_short_name === "INR");
    const usdtW = (data || []).find(w => w.currency_short_name === "USDT");
    if (inrW) inrBal = parseFloat(inrW.balance || 0);
    if (usdtW) usdtBal = parseFloat(usdtW.balance || 0);
  } catch(e) {
    try {
      const data = await coindcxRequest("/exchange/v1/users/balances", apiKey, apiSecret, {});
      const i = data.find?.(b => b.currency === "INR" || b.currency === "inr");
      const u = data.find?.(b => b.currency === "USDT" || b.currency === "usdt");
      if (i) inrBal = parseFloat(i.balance || i.available_balance || 0);
      if (u) usdtBal = parseFloat(u.balance || u.available_balance || 0);
    } catch(_){}
  }
  return { inr: inrBal, usdt: usdtBal };
}

// ─── Fetch real market tickers from CoinDCX public API ───────────────────────
async function fetchCoinDCXTickers(mode) {
  const data = await coindcxRequest("/exchange/ticker", null, null);
  const map = {};
  (data||[]).forEach(t=>{
    if (t.market && t.market.endsWith(mode)) {
      const pair = t.market.replace(mode,"") + "/" + mode;
      map[pair] = {
        pair,
        price:     fmt(parseFloat(t.last_price||0), parseFloat(t.last_price||0)<1?4:2),
        priceNum:  parseFloat(t.last_price||0),
        change24h: fmt(parseFloat(t.change_24_hour||0),2),
        volume:    fmt(parseFloat(t.volume||0)/(mode==="INR"?1e5:1e6), 2),
        high:      t.high, low: t.low,
        bid: t.bid, ask: t.ask,
        rsi:       fmt(Math.max(15,Math.min(85, 50 + parseFloat(t.change_24_hour||0)*2)),1),
        macd:      parseFloat(t.change_24_hour||0)>1?"bullish_cross":
                   parseFloat(t.change_24_hour||0)<-1?"bearish_cross":"neutral",
        bbands:    parseFloat(t.change_24_hour||0)>3?"above_upper":
                   parseFloat(t.change_24_hour||0)<-3?"below_lower":"inside",
        sentiment: Math.min(90,Math.max(10,50+parseFloat(t.change_24_hour||0)*3)),
      };
    }
  });
  return map;
}

// ─── Place real futures order on CoinDCX ────────────────────────────────────
async function placeFuturesOrder(apiKey, apiSecret, opp, positionSize) {
  const symbol = opp.pair.replace("/","_");
  const side   = opp.signal === "LONG" ? "buy" : "sell";
  const body = {
    market:        symbol,
    order_type:    "limit_order",
    side,
    price:         String(opp.entry),
    total_quantity: String(Math.floor(positionSize / opp.entry * 100)/100),
    leverage:      String(opp.leverage),
    time_in_force: "good_till_cancel",
    notification_preferences: { trade: false },
  };
  return coindcxRequest("/exchange/v1/derivatives/futures/orders/create", apiKey, apiSecret, body);
}

const getBase = (p,mode)=>BASE_PRICES[mode][p]||(Math.random()*10+0.5);

function genTicker(pair, prevPrice, mode) {
  const base=getBase(pair,mode), prev=prevPrice||base;
  const price=Math.max(base*0.7, prev+(Math.random()-0.49)*base*0.004);
  const d=price<0.0001?8:price<0.01?6:price<1?4:price<100?3:2;
  const ch=((price-base)/base)*100+(Math.random()-0.5)*3;
  return {
    pair, price:fmt(price,d), priceNum:price,
    change24h:fmt(ch,2),
    volume:(Math.random()*800+50).toFixed(1),
    rsi:fmt(Math.max(15,Math.min(85,50+(Math.random()-0.5)*50)),1),
    macd:["bullish_cross","bearish_cross","neutral"][Math.floor(Math.random()*3)],
    bbands:["above_upper","inside","below_lower"][Math.floor(Math.random()*3)],
    sentiment:Math.floor(Math.random()*70+15),
  };
}

// ─── Local multi-coin analysis ──────────────────────────────────────────────
function analyseAllCoins(tickers) {
  const scored = tickers.map(t => {
    const rsi = parseFloat(t.rsi || 50);
    const change = parseFloat(t.change24h || 0);
    let bullScore = 50;
    if (rsi < 30) bullScore += 20;
    if (rsi > 70) bullScore -= 15;
    if (change > 3) bullScore += 15;
    if ((t.macd || "").includes("bullish")) bullScore += 20;
    if ((t.bbands || "").includes("above")) bullScore += 10;
    if ((t.bbands || "").includes("below")) bullScore -= 15;
    
    const signal = bullScore > 60 ? "LONG" : bullScore < 40 ? "SHORT" : null;
    const confidence = Math.min(95, Math.max(signal ? bullScore : 50, 45));
    
    return { pair: t.pair, signal, confidence: Math.round(confidence), rsi, change };
  });
  
  const opportunities = scored
    .filter(s => s.signal)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10)
    .map((opp, idx) => {
      const ticker = tickers.find(t => t.pair === opp.pair);
      const price = parseFloat(ticker?.price || 1);
      const change = parseFloat(ticker?.change24h || 0);
      let entry, stopLoss, takeProfit, leverage;
      if (opp.signal === "LONG") {
        leverage = Math.round(3 + Math.random() * 4);
        entry = price;
        stopLoss = price * (1 - 0.025);
        takeProfit = price * (1 + 0.06);
      } else {
        leverage = Math.round(2 + Math.random() * 3);
        entry = price;
        stopLoss = price * (1 + 0.025);
        takeProfit = price * (1 - 0.05);
      }
      return {
        priority: idx + 1, pair: opp.pair, signal: opp.signal, confidence: opp.confidence,
        leverage, entry, stopLoss, takeProfit,
        riskRewardRatio: fmt(Math.abs((takeProfit - entry) / (entry - stopLoss))),
        expectedProfitPct: Math.round(Math.abs((takeProfit-entry)/entry)*100),
        reasoning: `RSI at ${Math.round(opp.rsi)}. ${opp.signal} signal with ${opp.confidence}% confidence.`,
        indicators: { trend: opp.signal === "LONG" ? "BULLISH" : "BEARISH", momentum: "STRONG", volatility: "HIGH" },
      };
    });
  
  return {
    topOpportunities: opportunities,
    marketSummary: {
      bullishCount: scored.filter(s => s.signal === "LONG").length,
      bearishCount: scored.filter(s => s.signal === "SHORT").length,
      neutralCount: scored.filter(s => !s.signal).length,
      marketMood: scored.filter(s => s.signal === "LONG").length > scored.filter(s => s.signal === "SHORT").length ? "BULLISH" : "BEARISH",
    },
  };
}

// ─── UI Components ──────────────────────────────────────────────────────────
function Sparkline({ data, color, width=80, height=26 }) {
  if (!data||data.length<2) return <div style={{width,height}}/>;
  const mn=Math.min(...data), range=(Math.max(...data)-mn)||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*width},${height-((v-mn)/range)*height}`).join(" ");
  return <svg width={width} height={height} style={{overflow:"visible",display:"block"}}>
    <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>;
}

function Gauge({value,label,max=100}) {
  const r=Math.min(1,Math.max(0,value/max));
  const col=r>0.7?C.bull:r>0.4?C.accent:C.bear;
  const circ=2*Math.PI*18;
  return <div style={{textAlign:"center"}}>
    <div style={{fontSize:8,color:C.textDim,marginBottom:2}}>{label}</div>
    <div style={{position:"relative",width:46,height:46,margin:"0 auto"}}>
      <svg width={46} height={46} style={{transform:"rotate(-90deg)"}}>
        <circle cx={23} cy={23} r={18} fill="none" stroke={C.border} strokeWidth={4}/>
        <circle cx={23} cy={23} r={18} fill="none" stroke={col} strokeWidth={4} strokeDasharray={`${r*circ} ${circ}`} strokeLinecap="round"/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",color:C.text,fontSize:11,fontWeight:700}}>{Math.round(value)}</div>
    </div>
  </div>;
}

function CoinRow({tk,opp,priceHist,onClick,selected,fmtC}) {
  const ch=parseFloat(tk?.change24h||0);
  const sc=!opp?"transparent":opp.signal==="LONG"?C.bull:C.bear;
  return (
    <div onClick={onClick} style={{
      display:"grid",gridTemplateColumns:"115px 95px 65px 55px 55px 68px 82px",
      padding:"5px 12px",cursor:"pointer",borderBottom:`1px solid ${C.border}22`,
      background:selected?`${C.accent}0d`:opp?`${sc}07`:"transparent",
      borderLeft:`2px solid ${opp?sc:"transparent"}`,
    }}>
      <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,fontWeight:700,color:C.text}}>{tk?.pair||"—"}</div>
      <div style={{fontSize:11,color:C.text,textAlign:"right"}}>{fmtC(tk?.price||0)}</div>
      <div style={{fontSize:11,color:ch>=0?C.bull:C.bear,textAlign:"right"}}>{ch>=0?"+":""}{tk?.change24h||"—"}%</div>
      <div style={{fontSize:11,color:C.textDim,textAlign:"right"}}>{tk?.rsi||"—"}</div>
      <div style={{fontSize:10,color:opp?sc:C.muted,textAlign:"right",fontWeight:opp?700:400}}>{opp?opp.signal:"—"}</div>
      <div style={{fontSize:10,color:opp?C.accent:C.muted,textAlign:"right"}}>{opp?`${opp.confidence}%`:"—"}</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end"}}><Sparkline data={priceHist} color={ch>=0?C.bull:C.bear} width={70} height={22}/></div>
    </div>
  );
}

function OppCard({opp,onTrade,isLive,disabled,fmtC}) {
  const sc=opp.signal==="LONG"?C.bull:C.bear;
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${sc}`,borderRadius:8,padding:"12px 14px",marginBottom:8,fontSize:11}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{background:`${sc}22`,color:sc,padding:"1px 8px",borderRadius:20,fontWeight:700}}>{opp.signal}</span>
          <span style={{color:C.text,fontWeight:700,fontSize:13}}>{opp.pair}</span>
        </div>
        <button onClick={()=>onTrade(opp)} disabled={disabled} style={{background:sc,color:"#000",borderRadius:5,padding:"4px 12px",fontSize:10,fontWeight:700}}>{isLive?"🔴 LIVE":"PAPER"} EXECUTE</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:8}}>
        {[["ENTRY",fmtC(opp.entry)],["STOP LOSS",fmtC(opp.stopLoss)],["TAKE PROFIT",fmtC(opp.takeProfit)]].map(([k,v])=>(
          <div key={k} style={{background:C.bg,borderRadius:4,padding:"6px 8px",border:`1px solid ${C.border}`}}>
            <div style={{fontSize:8,color:C.textDim}}>{k}</div>
            <div style={{fontSize:11,fontWeight:700,color:C.text}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{fontSize:10,color:C.textDim}}>{opp.reasoning}</div>
    </div>
  );
}

function TradeCard({t,fmtC}) {
  const sc=t.signal==="LONG"?C.bull:C.bear;
  const pnl=parseFloat(t.pnl||0);
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${sc}`,borderRadius:6,padding:"9px 12px",marginBottom:6,fontSize:10}}>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <span style={{color:sc,fontWeight:700}}>{t.signal} {t.pair}</span>
        <span style={{color:pnl>=0?C.bull:C.bear,fontWeight:700}}>{t.live?"(open)": (pnl>=0?"+":"")+fmtC(t.pnl)}</span>
      </div>
      <div style={{display:"flex",gap:12,color:C.textDim,marginTop:4}}>
        <span>Entry {fmtC(t.entry)}</span>
        <span>SL {fmtC(t.stopLoss)}</span>
        <span>Lev {t.leverage}×</span>
        <span style={{marginLeft:"auto"}}>{t.time}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [apiKey,     setApiKey]     = useState("cbc9c75aa4361b3fa372e01e54115bccd53b35ecabc30306");
  const [apiSecret,  setApiSecret]  = useState("");
  const [keyStatus,  setKeyStatus]  = useState("idle");
  const [isLive,     setIsLive]     = useState(false);
  const [walletMode, setWalletMode] = useState("INR"); // "INR" | "USDT"

  const allPairs = useMemo(()=>PAIRS[walletMode], [walletMode]);
  const fmtC = useCallback((n)=>walletMode==="INR"?inr(n):usd(n),[walletMode]);

  const [tickers,    setTickers]    = useState({});
  const [priceHists, setPriceHists] = useState({});
  const tickersRef   = useRef({});

  const [scanResult, setScanResult] = useState(null);
  const [scanning,   setScanning]   = useState(false);
  const [autoOn,     setAutoOn]     = useState(false);
  const [lastScan,   setLastScan]   = useState(null);

  const [balances,   setBalances]   = useState({ inr:1000000, usdt:10000 });
  const [riskPct,    setRiskPct]    = useState(1.5);
  const [trades,     setTrades]     = useState([]);

  const [activeTab,  setActiveTab]  = useState("scanner");
  const [filter,     setFilter]     = useState("ALL");
  const [search,     setSearch]     = useState("");
  const [selected,   setSelected]   = useState(null);
  const [log,        setLog]        = useState([]);

  const balRef  = useRef(balances);
  const riskRef = useRef(riskPct);
  const liveRef = useRef(isLive);
  const keyRef  = useRef({ key:"", secret:"" });
  const modeRef = useRef(walletMode);

  useEffect(()=>{ balRef.current  = balances;  },[balances]);
  useEffect(()=>{ riskRef.current = riskPct;   },[riskPct]);
  useEffect(()=>{ liveRef.current = isLive;    },[isLive]);
  useEffect(()=>{ modeRef.current = walletMode;},[walletMode]);

  const addLog = useCallback((msg,type="info")=>{
    setLog(l=>[{t:new Date().toLocaleTimeString(),msg,type},...l].slice(0,100));
  },[]);

  // ── Init tickers ────────────────────────────────────────────────────────
  useEffect(()=>{
    const init={};
    allPairs.forEach(p=>{ init[p]=genTicker(p,null,walletMode); });
    tickersRef.current=init;
    setTickers({...init});
    setPriceHists({});
    
    const id=setInterval(()=>{
      if (liveRef.current) return;
      const u={...tickersRef.current};
      allPairs.forEach(p=>{ u[p]=genTicker(p,u[p]?.priceNum,modeRef.current); });
      tickersRef.current=u;
      setTickers({...u});
      setPriceHists(prev=>{
        const n={...prev};
        allPairs.forEach(p=>{ n[p]=[...(n[p]||[]).slice(-39),u[p].priceNum]; });
        return n;
      });
    },2500);
    return ()=>clearInterval(id);
  },[walletMode, allPairs]);

  // ── Live poll ───────────────────────────────────────────────────────────
  useEffect(()=>{
    if (!isLive) return;
    const poll = async ()=>{
      try {
        const map = await fetchCoinDCXTickers(modeRef.current);
        const merged={...tickersRef.current};
        Object.keys(map).forEach(p=>{ if (PAIRS[modeRef.current].includes(p)) merged[p]=map[p]; });
        tickersRef.current=merged;
        setTickers({...merged});
        setPriceHists(prev=>{
          const n={...prev};
          PAIRS[modeRef.current].forEach(p=>{ if (merged[p]) n[p]=[...(n[p]||[]).slice(-39),merged[p].priceNum]; });
          return n;
        });
      } catch(e) { addLog(`Data error: ${e.message}`,"warn"); }
    };
    poll();
    const id=setInterval(poll,5000);
    return ()=>clearInterval(id);
  },[isLive, walletMode]);

  const validateKey = useCallback(async (key, secret)=>{
    if (!key||!secret) return;
    setKeyStatus("checking");
    try {
      const bals = await fetchBothBalances(key, secret);
      keyRef.current = { key, secret };
      setKeyStatus("valid");
      setIsLive(true);
      setBalances(bals);
      addLog(`✅ API key VALID — INR: ${inr(bals.inr)} | USDT: ${usd(bals.usdt)}`, "bull");
    } catch(e) {
      setKeyStatus("invalid");
      setIsLive(false);
      addLog(`❌ API key invalid: ${e.message}`, "warn");
    }
  },[addLog]);

  const executeTrade = useCallback(async (opp)=>{
    const b = balRef.current[modeRef.current.toLowerCase()];
    const posSize = b * (riskRef.current/100) * opp.leverage;
    if (liveRef.current && keyRef.current.key) {
      addLog(`🔴 LIVE order ${opp.pair}…`, "bull");
      try {
        await placeFuturesOrder(keyRef.current.key, keyRef.current.secret, opp, posSize);
        addLog(`✅ Live order placed!`, "bull");
        const newBals = await fetchBothBalances(keyRef.current.key, keyRef.current.secret);
        setBalances(newBals);
      } catch(e) { addLog(`❌ Failed: ${e.message}`, "warn"); }
    } else {
      const diff = opp.signal==="LONG" ? (opp.takeProfit-opp.entry)/opp.entry : (opp.entry-opp.takeProfit)/opp.entry;
      const netPnl = posSize*diff*0.7 - posSize*0.0006;
      setBalances(prev=>({...prev, [modeRef.current.toLowerCase()]: prev[modeRef.current.toLowerCase()]+netPnl}));
      setTrades(ts=>[{...opp, time:new Date().toLocaleTimeString(), pnl:netPnl, live:false},...ts]);
      addLog(`📝 Paper ${opp.signal} ${opp.pair} | PnL ${fmtC(netPnl)}`, netPnl>=0?"bull":"bear");
    }
  },[addLog, fmtC]);

  const scanAll = useCallback(async ()=>{
    setScanning(true);
    addLog(`🔍 Scanning ${allPairs.length} pairs…`);
    const snap=Object.values(tickersRef.current).filter(t=>t&&t.pair);
    const result=analyseAllCoins(snap);
    setScanResult(result);
    setLastScan(Date.now());
    addLog(`✅ Found ${result.topOpportunities.length} signals`, "bull");
    
    // Auto-trade logic
    if (autoRef.current && result.topOpportunities.length > 0) {
      const best = result.topOpportunities[0];
      if (best.confidence >= 75) {
        addLog(`🤖 Auto-executing #${best.priority} ${best.pair} (${best.confidence}% confidence)`, "bull");
        await executeTrade(best);
      }
    }
    
    setScanning(false);
  },[allPairs, addLog, executeTrade]);

  const scanRef = useRef(scanAll);
  useEffect(()=>{ scanRef.current = scanAll; },[scanAll]);

  useEffect(()=>{
    if (!autoOn) return;
    const id = setInterval(()=>scanRef.current(), 30000); // Scan every 30s in auto mode
    return ()=>clearInterval(id);
  },[autoOn]);

  const oppMap=useMemo(()=>{
    const m={};
    (scanResult?.topOpportunities||[]).forEach(o=>{ m[o.pair]=o; });
    return m;
  },[scanResult]);

  const filteredPairs=allPairs.filter(p=>{
    if (search&&!p.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter==="SIGNALS") return !!oppMap[p];
    return true;
  });

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"'IBM Plex Mono',monospace",fontSize:12}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=Exo+2:wght@900&display=swap');
        .btn{cursor:pointer;border:none;border-radius:5px;font-family:inherit;font-weight:700;padding:6px 12px}
        input{background:${C.panel};border:1px solid ${C.border};color:${C.text};border-radius:5px;padding:5px 8px;font-family:inherit}
      `}</style>

      {/* HEADER */}
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontFamily:"'Exo 2',sans-serif",fontSize:20,fontWeight:900,color:C.accent}}>APEX MULTI-SCANNER</div>
          <div style={{fontSize:9,color:C.textDim}}>{allPairs.length} {walletMode} PAIRS · {isLive?"LIVE":"PAPER"}</div>
        </div>

        <div style={{display:"flex",gap:10,background:C.bg,padding:4,borderRadius:6,border:`1px solid ${C.border}`}}>
          {["INR","USDT"].map(m=>(
            <button key={m} className="btn" 
              style={{background:walletMode===m?C.accent: "transparent", color:walletMode===m?"#000":C.textDim, padding:"4px 15px", fontSize:10}}
              onClick={()=>setWalletMode(m)}>{m} FUTURES</button>
          ))}
        </div>

        <div style={{textAlign:"right"}}>
          <div style={{fontSize:18,fontWeight:700,color:C.bull}}>{fmtC(balances[walletMode.toLowerCase()])}</div>
          <div style={{fontSize:9,color:C.textDim}}>{walletMode==="INR"?`($${fmt(balances.usdt)} USDT)` : `(${inr(balances.inr)} INR)`}</div>
        </div>
      </div>

      {/* KEYS */}
      <div style={{padding:"10px 16px",background:`${C.panel}88`,borderBottom:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"center"}}>
        <input type="text" placeholder="API Key" value={apiKey} onChange={e=>setApiKey(e.target.value)} style={{flex:1}}/>
        <input type="password" placeholder="Secret" value={apiSecret} onChange={e=>setApiSecret(e.target.value)} style={{flex:1}}/>
        <button className="btn" style={{background:C.bull,color:"#000"}} onClick={()=>validateKey(apiKey,apiSecret)}>{keyStatus==="checking"?"...":"CONNECT"}</button>
        <button className="btn" style={{background:C.accent,color:"#000"}} onClick={scanAll} disabled={scanning}>SCAN ALL</button>
        <button className="btn" style={{background:autoOn?C.bear:C.bull,color:"#000"}} 
          onClick={()=>{
            const n=!autoOn; setAutoOn(n);
            addLog(n?`🤖 AUTO TRADE ON (Every 30s)` : "⏹ AUTO STOPPED", n?"bull":"warn");
          }}>
          {autoOn?"STOP AUTO":"AUTO TRADE"}
        </button>
      </div>

      {/* TABS */}
      <div style={{display:"flex",gap:2,padding:"0 16px",background:C.panel,borderBottom:`1px solid ${C.border}`}}>
        {["scanner","signals","trades","log"].map(t=>(
          <button key={t} onClick={()=>setActiveTab(t)} style={{padding:"10px 20px",background:"transparent",border:"none",color:activeTab===t?C.accent:C.textDim,borderBottom:activeTab===t?`2px solid ${C.accent}`:"none",cursor:"pointer",fontWeight:700,fontSize:11}}>{t.toUpperCase()}</button>
        ))}
      </div>

      <div style={{padding:16}}>
        {activeTab==="scanner" && (
          <div>
            <div style={{display:"flex",gap:10,marginBottom:10}}><input placeholder="Search pairs..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:200}}/></div>
            <div style={{maxHeight:"calc(100vh - 300px)",overflowY:"auto"}}>
              {filteredPairs.map(p=>(
                <CoinRow key={p} tk={tickers[p]} opp={oppMap[p]} priceHist={priceHists[p]||[]} fmtC={fmtC} onClick={()=>setSelected(p)} selected={selected===p}/>
              ))}
            </div>
            {selected && tickers[selected] && (
              <div style={{marginTop:20,background:C.panel,padding:15,borderRadius:8,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:16,fontWeight:700,marginBottom:10}}>{selected}</div>
                {oppMap[selected] ? <OppCard opp={oppMap[selected]} onTrade={executeTrade} isLive={isLive} fmtC={fmtC}/> : <div>No signal yet.</div>}
              </div>
            )}
          </div>
        )}

        {activeTab==="signals" && (
          <div style={{maxHeight:"calc(100vh - 250px)",overflowY:"auto"}}>
            {scanResult?.topOpportunities.map((o,i)=><OppCard key={i} opp={o} onTrade={executeTrade} isLive={isLive} fmtC={fmtC}/>)}
          </div>
        )}

        {activeTab==="trades" && (
          <div style={{maxHeight:"calc(100vh - 250px)",overflowY:"auto"}}>
            {trades.map((t,i)=><TradeCard key={i} t={t} fmtC={fmtC}/>)}
          </div>
        )}

        {activeTab==="log" && (
          <div style={{background:C.panel,padding:10,borderRadius:5,maxHeight:"calc(100vh - 250px)",overflowY:"auto"}}>
            {log.map((l,i)=><div key={i} style={{color:l.type==="bull"?C.bull:l.type==="warn"?C.warn:C.textDim,fontSize:10,marginBottom:4}}><span style={{color:C.muted}}>[{l.t}]</span> {l.msg}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
