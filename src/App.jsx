import { useState, useEffect, useRef, useCallback } from "react";

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
const ago  = (ms)=>{ const s=Math.floor((Date.now()-ms)/1000); return s<60?`${s}s ago`:`${Math.floor(s/60)}m ago`; };

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
async function fetchCoinDCXTickers() {
  const data = await coindcxRequest("/exchange/ticker", null, null);
  const map = {};
  (data||[]).forEach(t=>{
    // Only INR pairs
    if (t.market && t.market.endsWith("INR")) {
      const pair = t.market.replace("INR","") + "/INR";
      map[pair] = {
        pair,
        price:     fmt(parseFloat(t.last_price||0), parseFloat(t.last_price||0)<1?4:2),
        priceNum:  parseFloat(t.last_price||0),
        change24h: fmt(parseFloat(t.change_24_hour||0),2),
        volume:    fmt(parseFloat(t.volume||0)/1e5, 2),
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
async function placeFuturesOrder(apiKey, apiSecret, opp, positionSizeINR) {
  // CoinDCX futures order endpoint
  const symbol = opp.pair.replace("/","_"); // BTC/USDT -> BTC_USDT
  const side   = opp.signal === "LONG" ? "buy" : "sell";

  const body = {
    market:        symbol,
    order_type:    "limit_order",
    side,
    price:         String(opp.entry),
    total_quantity: String(Math.floor(positionSizeINR / opp.entry * 100)/100),
    leverage:      String(opp.leverage),
    time_in_force: "good_till_cancel",
    notification_preferences: { trade: false },
  };

  const data = await coindcxRequest(
    "/exchange/v1/derivatives/futures/orders/create",
    apiKey, apiSecret, body
  );

  return data;
}

// ─── All known CoinDCX futures pairs ────────────────────────────────────────
const ALL_PAIRS = [
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
];

// ─── Simulated ticker fallback ───────────────────────────────────────────────
const BASE_PRICES = {
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
};
const getBase = p=>BASE_PRICES[p]||(Math.random()*10+0.5);

function genTicker(pair, prevPrice) {
  const base=getBase(pair), prev=prevPrice||base;
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

// ─── Local multi-coin analysis (no external API) ───────────────────────────
function analyseAllCoins(tickers) {
  // Score each coin based on technical indicators
  const scored = tickers.map(t => {
    const rsi = parseFloat(t.rsi || 50);
    const change = parseFloat(t.change24h || 0);
    const bullish_cross = (t.macd || "").includes("bullish");
    const bearish_cross = (t.macd || "").includes("bearish");
    const above_upper = (t.bbands || "").includes("above");
    const below_lower = (t.bbands || "").includes("below");
    
    // Calculate bullish score (0-100)
    let bullScore = 50;
    if (rsi < 30) bullScore += 20;        // Oversold = bounce potential
    if (rsi > 70) bullScore -= 15;        // Overbought
    if (change > 3) bullScore += 15;      // Strong recent up
    if (bullish_cross) bullScore += 20;   // MACD bullish cross
    if (above_upper) bullScore += 10;     // Above BB upper
    if (below_lower) bullScore -= 15;     // Below BB lower
    
    const signal = bullScore > 60 ? "LONG" : bullScore < 40 ? "SHORT" : null;
    const confidence = Math.min(95, Math.max(signal ? bullScore : 50, 45));
    
    return {
      pair: t.pair,
      signal,
      confidence: Math.round(confidence),
      bullScore,
      change,
      rsi,
    };
  });
  
  // Filter valid signals and sort by confidence
  const opportunities = scored
    .filter(s => s.signal)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10)  // Top 10
    .map((opp, idx) => {
      const ticker = tickers.find(t => t.pair === opp.pair);
      const price = parseFloat(ticker?.price || 1);
      const change = parseFloat(ticker?.change24h || 0);
      
      // Determine entry, stop loss, take profit
      let entry, stopLoss, takeProfit, leverage;
      
      if (opp.signal === "LONG") {
        leverage = Math.round(3 + Math.random() * 4); // 3-7x
        entry = price;
        stopLoss = price * (1 - 0.02 - Math.random() * 0.01);  // 2-3% below
        takeProfit = price * (1 + 0.05 + Math.random() * 0.03); // 5-8% above
      } else {
        leverage = Math.round(2 + Math.random() * 3); // 2-5x
        entry = price;
        stopLoss = price * (1 + 0.02 + Math.random() * 0.01);   // 2-3% above
        takeProfit = price * (1 - 0.04 - Math.random() * 0.02); // 4-6% below
      }
      
      const riskRewardRatio = Math.abs(
        (takeProfit - entry) / (entry - stopLoss)
      ) || 1.5;
      
      return {
        priority: idx + 1,
        pair: opp.pair,
        signal: opp.signal,
        confidence: opp.confidence,
        leverage,
        entry: Math.round(entry * 10000) / 10000,
        stopLoss: Math.round(stopLoss * 10000) / 10000,
        takeProfit: Math.round(takeProfit * 10000) / 10000,
        riskRewardRatio: Math.round(riskRewardRatio * 100) / 100,
        expectedProfitPct: Math.round(
          (opp.signal === "LONG" 
            ? ((takeProfit - entry) / entry) 
            : ((entry - takeProfit) / entry)) * 100
        ),
        reasoning: opp.signal === "LONG"
          ? `RSI at ${Math.round(opp.rsi)}. Recent ${change > 0 ? "bullish" : "bearish"} momentum (${change}%). Entry on support.`
          : `RSI at ${Math.round(opp.rsi)}. Recent bearish trend (${change}%). Entry on resistance.`,
        indicators: {
          trend: opp.signal === "LONG" ? "BULLISH" : "BEARISH",
          momentum: opp.confidence > 75 ? "STRONG" : opp.confidence > 60 ? "MODERATE" : "WEAK",
          volatility: Math.abs(change) > 5 ? "HIGH" : Math.abs(change) > 2 ? "MEDIUM" : "LOW",
        },
      };
    });
  
  // Market summary
  const bullCount = scored.filter(s => s.signal === "LONG").length;
  const bearCount = scored.filter(s => s.signal === "SHORT").length;
  const neutralCount = scored.filter(s => !s.signal).length;
  
  const topBullish = scored
    .filter(s => s.signal === "LONG")
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map(s => s.pair);
  
  const topBearish = scored
    .filter(s => s.signal === "SHORT")
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2)
    .map(s => s.pair);
  
  const marketMood = bullCount > bearCount * 1.5 ? "BULLISH" : bearCount > bullCount * 1.5 ? "BEARISH" : "NEUTRAL";
  
  return {
    topOpportunities: opportunities,
    marketSummary: {
      bullishCount: bullCount,
      bearishCount: bearCount,
      neutralCount: neutralCount,
      topBullish,
      topBearish,
      marketMood,
    },
  };
}

// ─── Sparkline ───────────────────────────────────────────────────────────────
function Sparkline({ data, color, width=80, height=26 }) {
  if (!data||data.length<2) return <div style={{width,height}}/>;
  const mn=Math.min(...data), range=(Math.max(...data)-mn)||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*width},${height-((v-mn)/range)*height}`).join(" ");
  return <svg width={width} height={height} style={{overflow:"visible",display:"block"}}>
    <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>;
}

// ─── Gauge ───────────────────────────────────────────────────────────────────
function Gauge({value,label,max=100}) {
  const r=Math.min(1,Math.max(0,value/max));
  const col=r>0.7?C.bull:r>0.4?C.accent:C.bear;
  const circ=2*Math.PI*18;
  return <div style={{textAlign:"center"}}>
    <div style={{fontSize:8,color:C.textDim,marginBottom:2}}>{label}</div>
    <div style={{position:"relative",width:46,height:46,margin:"0 auto"}}>
      <svg width={46} height={46} style={{transform:"rotate(-90deg)"}}>
        <circle cx={23} cy={23} r={18} fill="none" stroke={C.border} strokeWidth={4}/>
        <circle cx={23} cy={23} r={18} fill="none" stroke={col} strokeWidth={4}
          strokeDasharray={`${r*circ} ${circ}`} strokeLinecap="round"/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",
        justifyContent:"center",color:C.text,fontSize:11,fontWeight:700}}>
        {Math.round(value)}
      </div>
    </div>
  </div>;
}

// ─── CoinRow ─────────────────────────────────────────────────────────────────
function CoinRow({tk,opp,priceHist,onClick,selected}) {
  const ch=parseFloat(tk?.change24h||0);
  const chCol=ch>=0?C.bull:C.bear;
  const sc=!opp?"transparent":opp.signal==="LONG"?C.bull:C.bear;
  return (
    <div onClick={onClick} style={{
      display:"grid",gridTemplateColumns:"115px 95px 65px 55px 55px 68px 82px",
      padding:"5px 12px",cursor:"pointer",borderBottom:`1px solid ${C.border}22`,
      background:selected?`${C.accent}0d`:opp?`${sc}07`:"transparent",
      borderLeft:`2px solid ${opp?sc:"transparent"}`,
      transition:"background .1s",
    }}>
      <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,fontWeight:700,color:C.text}}>
        {opp&&<span style={{width:5,height:5,borderRadius:"50%",background:sc,display:"inline-block",flexShrink:0}}/>}
        {tk?.pair||"—"}
      </div>
      <div style={{fontSize:11,color:C.text,textAlign:"right",fontVariantNumeric:"tabular-nums"}}>${tk?.price||"—"}</div>
      <div style={{fontSize:11,color:chCol,textAlign:"right"}}>{ch>=0?"+":""}{tk?.change24h||"—"}%</div>
      <div style={{fontSize:11,color:C.textDim,textAlign:"right"}}>{tk?.rsi||"—"}</div>
      <div style={{fontSize:10,color:opp?sc:C.muted,textAlign:"right",fontWeight:opp?700:400}}>{opp?opp.signal:"—"}</div>
      <div style={{fontSize:10,color:opp?C.accent:C.muted,textAlign:"right"}}>{opp?`${opp.confidence}%`:"—"}</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
        <Sparkline data={priceHist} color={chCol} width={70} height={22}/>
      </div>
    </div>
  );
}

// ─── OppCard ──────────────────────────────────────────────────────────────────
function OppCard({opp,onTrade,isLive,disabled}) {
  const sc=opp.signal==="LONG"?C.bull:C.bear;
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${sc}`,
      borderRadius:8,padding:"12px 14px",marginBottom:8,fontSize:11}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{background:`${sc}22`,color:sc,padding:"1px 8px",borderRadius:20,fontWeight:700,fontSize:12}}>
            {opp.signal}
          </span>
          <span style={{color:C.text,fontWeight:700,fontSize:13}}>{opp.pair}</span>
          <span style={{color:C.textDim,fontSize:9}}>#{opp.priority}</span>
        </div>
        <button onClick={()=>onTrade(opp)} disabled={disabled}
          style={{background:sc,color:"#000",border:"none",borderRadius:5,padding:"4px 12px",
            fontSize:10,fontWeight:700,cursor:"pointer",opacity:disabled?.5:1,
            boxShadow:isLive?`0 0 8px ${sc}66`:"none"}}>
          {isLive?"🔴 LIVE EXECUTE":"PAPER EXECUTE"}
        </button>
      </div>
      <div style={{display:"flex",justifyContent:"space-around",marginBottom:10}}>
        <Gauge value={opp.confidence} label="CONF" max={100}/>
        <Gauge value={opp.leverage}   label="LEV"  max={20}/>
        <Gauge value={opp.riskRewardRatio*20} label="R:R×20" max={100}/>
        <Gauge value={Math.min(100,opp.expectedProfitPct*5)} label="EXP%" max={100}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:8}}>
        {[["ENTRY",inr(opp.entry)],["STOP LOSS",inr(opp.stopLoss)],["TAKE PROFIT",inr(opp.takeProfit)]].map(([k,v])=>(
          <div key={k} style={{background:C.bg,borderRadius:4,padding:"6px 8px",border:`1px solid ${C.border}`}}>
            <div style={{fontSize:8,color:C.textDim}}>{k}</div>
            <div style={{fontSize:11,fontWeight:700,color:C.text}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:12,marginBottom:7,flexWrap:"wrap"}}>
        {[["TREND",opp.indicators?.trend],["MOM",opp.indicators?.momentum],["VOL",opp.indicators?.volatility],
          ["EXP PNL",`+${fmt(opp.expectedProfitPct)}%`]].map(([k,v])=>(
          <div key={k} style={{fontSize:9,color:C.textDim}}>{k}:<span style={{color:C.accent,marginLeft:3}}>{v}</span></div>
        ))}
      </div>
      <div style={{fontSize:10,color:C.textDim,lineHeight:1.5}}>{opp.reasoning}</div>
    </div>
  );
}

// ─── TradeCard ────────────────────────────────────────────────────────────────
function TradeCard({t}) {
  const sc=t.signal==="LONG"?C.bull:C.bear;
  const pnl=parseFloat(t.pnl||0);
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`3px solid ${sc}`,
      borderRadius:6,padding:"9px 12px",marginBottom:6,fontSize:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{color:sc,fontWeight:700}}>{t.signal} {t.pair}</span>
          {t.live && <span style={{background:`${C.bull}22`,color:C.bull,padding:"0 5px",borderRadius:3,fontSize:8,fontWeight:700}}>LIVE</span>}
          {t.orderId && <span style={{color:C.textDim,fontSize:9}}>#{t.orderId.slice(-8)}</span>}
        </div>
        <span style={{color:pnl>=0?C.bull:C.bear,fontWeight:700}}>
          {t.live?"(open)": (pnl>=0?"+":"")+inr(t.pnl)}
        </span>
      </div>
      <div style={{display:"flex",gap:12,color:C.textDim}}>
        <span>Entry {inr(t.entry)}</span>
        <span>SL {inr(t.stopLoss)}</span>
        <span>TP {inr(t.takeProfit)}</span>
        <span>Lev {t.leverage}×</span>
        <span style={{marginLeft:"auto"}}>{t.time}</span>
      </div>
    </div>
  );
}

// ─── API key status badge ─────────────────────────────────────────────────────
function KeyBadge({status}) {
  const cfg = {
    idle:     {col:C.muted,  bg:`${C.muted}22`,  label:"NO KEY"},
    checking: {col:C.warn,   bg:`${C.warn}22`,   label:"CHECKING…"},
    valid:    {col:C.bull,   bg:`${C.bull}22`,   label:"🟢 LIVE"},
    invalid:  {col:C.bear,   bg:`${C.bear}22`,   label:"❌ INVALID"},
    error:    {col:C.warn,   bg:`${C.warn}22`,   label:"⚠ ERROR"},
  }[status]||{col:C.muted,bg:`${C.muted}22`,label:"—"};
  return (
    <span style={{background:cfg.bg,color:cfg.col,padding:"2px 10px",borderRadius:20,
      fontSize:10,fontWeight:700,letterSpacing:.5}}>
      {cfg.label}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  // ── API keys ──
  const [apiKey,     setApiKey]     = useState("cbc9c75aa4361b3fa372e01e54115bccd53b35ecabc30306");
  const [apiSecret,  setApiSecret]  = useState("");
  const [keyStatus,  setKeyStatus]  = useState("idle"); // idle|checking|valid|invalid|error
  const [isLive,     setIsLive]     = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // ── Market data ──
  const [tickers,    setTickers]    = useState({});
  const [priceHists, setPriceHists] = useState({});
  const tickersRef   = useRef({});

  // ── Scan / analysis ──
  const [scanResult, setScanResult] = useState(null);
  const [scanning,   setScanning]   = useState(false);
  const [autoOn,     setAutoOn]     = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [lastScan,   setLastScan]   = useState(null);

  // ── Portfolio ──
  const [capital,    setCapital]    = useState(1000000);
  const [balance,    setBalance]    = useState(1000000);
  const [usdtBalance, setUsdtBalance] = useState(0);
  const [liveBalance,setLiveBalance]= useState(null);
  const [liveUsdtBalance, setLiveUsdtBalance] = useState(null);
  const [riskPct,    setRiskPct]    = useState(1.5);
  const [trades,     setTrades]     = useState([]);

  // ── UI ──
  const [activeTab,  setActiveTab]  = useState("scanner");
  const [filter,     setFilter]     = useState("ALL");
  const [sortBy,     setSortBy]     = useState("confidence");
  const [search,     setSearch]     = useState("");
  const [selected,   setSelected]   = useState(null);
  const [log,        setLog]        = useState([]);
  const [errMsg,     setErrMsg]     = useState("");

  const balRef  = useRef(balance);
  const riskRef = useRef(riskPct);
  const autoRef = useRef(autoOn);
  const liveRef = useRef(isLive);
  const keyRef  = useRef({ key:"", secret:"" });

  useEffect(()=>{ balRef.current  = balance;  },[balance]);
  useEffect(()=>{ riskRef.current = riskPct;  },[riskPct]);
  useEffect(()=>{ autoRef.current = autoOn;   },[autoOn]);
  useEffect(()=>{ liveRef.current = isLive;   },[isLive]);

  const addLog = useCallback((msg,type="info")=>{
    setLog(l=>[{t:new Date().toLocaleTimeString(),msg,type},...l].slice(0,120));
  },[]);

  // ── Init simulated tickers ──────────────────────────────────────────────
  useEffect(()=>{
    const init={};
    ALL_PAIRS.forEach(p=>{ init[p]=genTicker(p,null); });
    tickersRef.current=init;
    setTickers({...init});

    // Tick sim every 2.5s (overridden by real data when live)
    const id=setInterval(()=>{
      if (liveRef.current) return; // skip sim if live
      const u={...tickersRef.current};
      ALL_PAIRS.forEach(p=>{ u[p]=genTicker(p,u[p]?.priceNum); });
      tickersRef.current=u;
      setTickers({...u});
      setPriceHists(prev=>{
        const n={...prev};
        ALL_PAIRS.forEach(p=>{ n[p]=[...(n[p]||[]).slice(-39),u[p].priceNum]; });
        return n;
      });
    },2500);
    return ()=>clearInterval(id);
  },[]);

  // ── Real market data poll when live ────────────────────────────────────
  useEffect(()=>{
    if (!isLive) return;
    const poll = async ()=>{
      try {
        const map = await fetchCoinDCXTickers();
        const merged={...tickersRef.current};
        Object.keys(map).forEach(p=>{
          if (ALL_PAIRS.includes(p)) merged[p]=map[p];
        });
        tickersRef.current=merged;
        setTickers({...merged});
        setPriceHists(prev=>{
          const n={...prev};
          ALL_PAIRS.forEach(p=>{
            if (merged[p]) n[p]=[...(n[p]||[]).slice(-39),merged[p].priceNum];
          });
          return n;
        });
      } catch(e) {
        addLog(`Market data fetch error: ${e.message}`,"warn");
      }
    };
    poll();
    const id=setInterval(poll,5000);
    return ()=>clearInterval(id);
  },[isLive,addLog]);

  // ── Validate API key ────────────────────────────────────────────────────
  const validateKey = useCallback(async (key, secret)=>{
    if (!key||!secret) { setKeyStatus("idle"); setIsLive(false); return; }
    setKeyStatus("checking");
    addLog("🔑 Validating CoinDCX API key…");
    try {
      const bals = await fetchBothBalances(key, secret);
      keyRef.current = { key, secret };
      setKeyStatus("valid");
      setIsLive(true);
      setLiveBalance(bals.inr);
      setLiveUsdtBalance(bals.usdt);
      setBalance(bals.inr);
      setUsdtBalance(bals.usdt);
      setCapital(bals.inr);
      balRef.current = bals.inr;
      addLog(`✅ API key VALID — Live: ${inr(bals.inr)} | ${fmt(bals.usdt)} USDT`, "bull");
      addLog(`🟢 Switched to LIVE TRADING MODE (INR)`, "bull");
    } catch(e) {
      setKeyStatus("invalid");
      setIsLive(false);
      setLiveBalance(null);
      setLiveUsdtBalance(null);
      addLog(`❌ API key invalid: ${e.message}`, "warn");
    }
  },[addLog]);

  // Auto-validate on input - checks immediately when both fields are filled
  const handleKeyInput = (k, s) => {
    if (k && s) {
      // Both fields present - validate immediately
      if (keyStatus !== "checking") {
        validateKey(k, s);
      }
    } else {
      // Missing either field
      setKeyStatus("idle");
      setIsLive(false);
    }
  };

  // ── Execute trade ───────────────────────────────────────────────────────
  const executeTrade = useCallback(async (opp)=>{
    const bal  = balRef.current;
    const risk = riskRef.current;
    const live = liveRef.current;
    const {key,secret} = keyRef.current;

    const posSize = bal * (risk/100) * opp.leverage;

    if (live && key && secret) {
      // ── LIVE ORDER ──
      addLog(`🔴 Placing LIVE ${opp.signal} order on ${opp.pair}…`, "bull");
      try {
        const order = await placeFuturesOrder(key, secret, opp, posSize);
        const orderId = order?.id || order?.order_id || "—";
        addLog(`✅ Live order placed! ID: ${orderId}`, "bull");

        // Refresh balance
        try {
          const bals = await fetchBothBalances(key,secret);
          setBalance(bals.inr); balRef.current=bals.inr; setLiveBalance(bals.inr);
          setUsdtBalance(bals.usdt); setLiveUsdtBalance(bals.usdt);
          addLog(`💰 Updated balance: ${inr(bals.inr)}`);
        } catch(_){}

        setTrades(ts=>[{
          ...opp, pair:opp.pair, time:new Date().toLocaleTimeString(),
          pnl:"0.00", live:true, orderId,
        },...ts].slice(0,50));
      } catch(e) {
        addLog(`❌ Order failed: ${e.message}`, "warn");
        setErrMsg(`Order failed: ${e.message}`);
      }
    } else {
      // ── PAPER TRADE ──
      const diff = opp.signal==="LONG"
        ? (opp.takeProfit-opp.entry)/opp.entry
        : (opp.entry-opp.takeProfit)/opp.entry;
      const netPnl = posSize*diff*0.72 - posSize*0.0006;
      const newBal = Math.max(0, bal+netPnl);
      setBalance(newBal); balRef.current=newBal;
      setTrades(ts=>[{
        ...opp, pair:opp.pair, time:new Date().toLocaleTimeString(),
        pnl:fmt(netPnl,2), live:false,
      },...ts].slice(0,50));
      addLog(`📝 Paper ${opp.signal} ${opp.pair} @ ${inr(opp.entry)} | Est PnL ${netPnl>=0?"+":""}${inr(netPnl)}`,
        netPnl>=0?"bull":"bear");
    }
  },[addLog]);

  // ── Scan all coins ──────────────────────────────────────────────────────
  const scanAll = useCallback(async ()=>{
    setScanning(true); setErrMsg(""); setProgress(10);
    addLog(`🔍 Scanning ${ALL_PAIRS.length} pairs…${liveRef.current?" [LIVE DATA]":" [SIM DATA]"}`);
    try {
      const snap=Object.values(tickersRef.current).filter(t=>t&&t.pair);
      setProgress(35);
      const result=analyseAllCoins(snap);  // Local analysis - no async needed
      setProgress(90);
      setScanResult(result);
      setLastScan(Date.now());

      const opps=result.topOpportunities||[];
      const mood=result.marketSummary?.marketMood||"NEUTRAL";
      addLog(`✅ ${opps.length} opportunities | Market: ${mood}`,
        mood==="BULLISH"?"bull":mood==="BEARISH"?"bear":"info");
      opps.slice(0,5).forEach(o=>{
        addLog(`  #${o.priority} ${o.signal} ${o.pair} | Conf ${o.confidence}% | R:R 1:${fmt(o.riskRewardRatio)} | Exp +${fmt(o.expectedProfitPct)}%`,
          o.signal==="LONG"?"bull":"bear");
      });

      // Auto-execute best if confidence ≥ 65
      if (autoRef.current && opps.length>0 && opps[0].confidence>=65) {
        await executeTrade(opps[0]);
      }
    } catch(e) {
      console.error(e); setErrMsg(e.message);
      addLog(`❌ ${e.message}`,"warn");
    }
    setProgress(100);
    setTimeout(()=>setProgress(0),600);
    setScanning(false);
  },[addLog,executeTrade]);

  const scanRef=useRef(scanAll);
  useEffect(()=>{ scanRef.current=scanAll; },[scanAll]);

  useEffect(()=>{
    if (!autoOn) return;
    scanRef.current();
    const id=setInterval(()=>scanRef.current(),30000);
    return ()=>clearInterval(id);
  },[autoOn]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const oppMap={};
  (scanResult?.topOpportunities||[]).forEach(o=>{ oppMap[o.pair]=o; });

  const displayBalance = isLive && liveBalance!=null ? liveBalance : balance;
  const pnl    = displayBalance-capital;
  const pnlPct = ((displayBalance-capital)/capital)*100;

  const filteredPairs=ALL_PAIRS.filter(p=>{
    if (search&&!p.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter==="SIGNALS") return !!oppMap[p];
    if (filter==="LONG")    return oppMap[p]?.signal==="LONG";
    if (filter==="SHORT")   return oppMap[p]?.signal==="SHORT";
    return true;
  });

  const sortedOpps=[...(scanResult?.topOpportunities||[])].sort((a,b)=>{
    if (sortBy==="confidence") return b.confidence-a.confidence;
    if (sortBy==="rr")         return b.riskRewardRatio-a.riskRewardRatio;
    if (sortBy==="profit")     return b.expectedProfitPct-a.expectedProfitPct;
    return a.priority-b.priority;
  });

  const summary=scanResult?.marketSummary;
  const winCount  = trades.filter(t=>!t.live&&parseFloat(t.pnl)>=0).length;
  const lossCount = trades.filter(t=>!t.live&&parseFloat(t.pnl)<0).length;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,
      fontFamily:"'IBM Plex Mono',monospace",boxSizing:"border-box",fontSize:12}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=Exo+2:wght@900&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
        .btn{cursor:pointer;border:none;border-radius:5px;font-family:'IBM Plex Mono',monospace;font-weight:700;transition:filter .12s,opacity .12s}
        .btn:hover{filter:brightness(1.18)}.btn:disabled{opacity:.4;cursor:not-allowed}
        .tab{cursor:pointer;padding:7px 14px;border:none;font-family:inherit;font-size:11px;font-weight:700;transition:all .12s;background:transparent}
        input,select{background:${C.panel};border:1px solid ${C.border};color:${C.text};border-radius:5px;padding:5px 8px;font-family:inherit;font-size:11px;outline:none}
        input:focus,select:focus{border-color:${C.accent}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}.pulse{animation:pulse 1.2s infinite}
        @keyframes fi{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}.fi{animation:fi .25s ease}
        @keyframes glow{0%,100%{box-shadow:0 0 4px ${C.bull}44}50%{box-shadow:0 0 12px ${C.bull}88}}.glow{animation:glow 2s infinite}
      `}</style>

      {/* ── HEADER ── */}
      <div style={{background:C.panel,borderBottom:`1px solid ${C.border}`,padding:"10px 16px",
        display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <div>
          <div style={{fontFamily:"'Exo 2',sans-serif",fontSize:18,fontWeight:900,letterSpacing:-0.5,display:"flex",alignItems:"center",gap:10}}>
            <span style={{color:C.accent}}>APEX</span>
            <span style={{color:C.text}}>MULTI-SCANNER</span>
            <KeyBadge status={keyStatus}/>
            {isLive && <span className="glow" style={{width:8,height:8,borderRadius:"50%",background:C.bull,display:"inline-block"}}/>}
          </div>
          <div style={{fontSize:9,color:C.textDim}}>
            {ALL_PAIRS.length} PAIRS · COINDCX FUTURES · {isLive?"LIVE DATA":"SIMULATED DATA"}
            {lastScan&&<span style={{marginLeft:8,color:C.muted}}>Last scan: {ago(lastScan)}</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
          {summary&&(
            <div style={{display:"flex",gap:10,fontSize:10}}>
              <span style={{color:C.bull}}>▲{summary.bullishCount}</span>
              <span style={{color:C.bear}}>▼{summary.bearishCount}</span>
              <span style={{color:C.muted}}>—{summary.neutralCount}</span>
              <span style={{color:summary.marketMood==="BULLISH"?C.bull:summary.marketMood==="BEARISH"?C.bear:C.muted,fontWeight:700}}>
                {summary.marketMood}
              </span>
            </div>
          )}
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:9,color:isLive?C.bull:C.textDim,marginBottom:1}}>
              {isLive?"🟢 LIVE BALANCES":"PAPER BALANCE"}
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",alignItems:"baseline"}}>
              {isLive && (
                <div style={{fontSize:10,color:C.textDim,textAlign:"right"}}>
                  {fmt(isLive && liveUsdtBalance!=null ? liveUsdtBalance : usdtBalance)} USDT
                </div>
              )}
              <div style={{fontSize:17,fontWeight:700,color:pnl>=0?C.bull:C.bear}}>
                {inr(displayBalance)}
              </div>
            </div>
            <div style={{fontSize:10,color:pnl>=0?C.bull:C.bear}}>{pnl>=0?"+":""}{inr(pnl)} ({fmtP(pnlPct)})</div>
          </div>
        </div>
      </div>

      {/* ── PROGRESS BAR ── */}
      {scanning&&progress>0&&progress<100&&(
        <div style={{height:2,background:C.border}}>
          <div style={{height:2,background:C.accent,width:`${progress}%`,transition:"width .3s"}}/>
        </div>
      )}

      {/* ── API KEY CONFIG ── */}
      <div style={{background:`${C.panel}ee`,borderBottom:`1px solid ${C.border}`,padding:"8px 16px",
        display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>

        {/* Live mode indicator */}
        <div style={{
          padding:"3px 10px",borderRadius:4,fontSize:10,fontWeight:700,
          background:isLive?`${C.bull}18`:`${C.warn}18`,
          border:`1px solid ${isLive?C.bull:C.warn}44`,
          color:isLive?C.bull:C.warn,
        }}>
          {isLive?"🔴 LIVE":"📝 PAPER"}
        </div>

        <div style={{display:"flex",alignItems:"center",gap:5,flex:1,minWidth:200}}>
          <span style={{fontSize:9,color:C.textDim,whiteSpace:"nowrap"}}>API KEY</span>
          <input type="text" placeholder="Enter CoinDCX API key → auto-validates"
            value={apiKey} style={{flex:1}}
            onChange={e=>{
              setApiKey(e.target.value);
              handleKeyInput(e.target.value, apiSecret);
            }}/>
        </div>

        <div style={{display:"flex",alignItems:"center",gap:5,flex:1,minWidth:200}}>
          <span style={{fontSize:9,color:C.textDim,whiteSpace:"nowrap"}}>SECRET</span>
          <input type={showSecret?"text":"password"} placeholder="Enter API secret"
            value={apiSecret} style={{flex:1}}
            onChange={e=>{
              setApiSecret(e.target.value);
              handleKeyInput(apiKey, e.target.value);
            }}/>
          <button className="btn" style={{background:C.border,color:C.textDim,padding:"3px 7px",fontSize:9}}
            onClick={()=>setShowSecret(s=>!s)}>
            {showSecret?"HIDE":"SHOW"}
          </button>
        </div>

        {keyStatus==="valid" && (
          <button className="btn" style={{background:`${C.bull}22`,color:C.bull,padding:"4px 10px",fontSize:9}}
            onClick={async()=>{
              try {
                const bals=await fetchBothBalances(keyRef.current.key,keyRef.current.secret);
                setLiveBalance(bals.inr); setBalance(bals.inr); balRef.current=bals.inr;
                setLiveUsdtBalance(bals.usdt); setUsdtBalance(bals.usdt);
                addLog(`💰 Balances refreshed: ${inr(bals.inr)} | ${fmt(bals.usdt)} USDT`,"bull");
              } catch(e){ addLog(`Refresh failed: ${e.message}`,"warn"); }
            }}>
            ↻ REFRESH BAL
          </button>
        )}

        <div style={{display:"flex",gap:5,alignItems:"center",marginLeft:"auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{fontSize:9,color:C.textDim}}>RISK%</span>
            <input type="number" min="0.5" max="10" step="0.5" value={riskPct} style={{width:58}}
              onChange={e=>setRiskPct(+e.target.value)}/>
          </div>
          {!isLive&&(
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={{fontSize:9,color:C.textDim}}>CAP$</span>
              <input type="number" min="100" step="500" value={capital} style={{width:88}}
                onChange={e=>{ const v=+e.target.value; setCapital(v); setBalance(v); }}/>
            </div>
          )}
        </div>

        <button className="btn"
          style={{background:scanning?C.border:C.accent,color:"#000",padding:"6px 14px",fontSize:11}}
          onClick={scanAll} disabled={scanning}>
          {scanning?<span className="pulse">Scanning…</span>:`⚡ SCAN ALL`}
        </button>
        <button className="btn"
          style={{background:autoOn?C.bear:C.bull,color:"#000",padding:"6px 12px",fontSize:11}}
          onClick={()=>{
            const n=!autoOn; setAutoOn(n);
            addLog(n?`🤖 Auto ${isLive?"LIVE":"paper"} trade ON (30s)`:"⏹ Auto stopped",n?"bull":"warn");
          }}>
          {autoOn?"⏹ STOP":"🤖 AUTO"}
        </button>
      </div>

      {/* ── ERROR ── */}
      {errMsg&&(
        <div style={{background:`${C.bear}10`,borderBottom:`1px solid ${C.bear}40`,
          padding:"6px 16px",fontSize:10,color:C.bear,display:"flex",justifyContent:"space-between"}}>
          <span>❌ {errMsg}</span>
          <button className="btn" style={{background:"transparent",color:C.bear,padding:"0 6px",fontSize:12}}
            onClick={()=>setErrMsg("")}>×</button>
        </div>
      )}

      {/* ── TABS ── */}
      <div style={{borderBottom:`1px solid ${C.border}`,padding:"0 16px",display:"flex",gap:2,background:C.panel}}>
        {[
          ["scanner",  `📡 SCANNER (${filteredPairs.length}/${ALL_PAIRS.length})`],
          ["opportunities", `🎯 SIGNALS ${scanResult?`(${sortedOpps.length})`:"(0)"}`],
          ["trades",   `📋 TRADES (${trades.length})`],
          ["log",      "📜 LOG"],
        ].map(([id,label])=>(
          <button key={id} className="tab"
            style={{color:activeTab===id?C.accent:C.textDim,
              borderBottom:activeTab===id?`2px solid ${C.accent}`:"2px solid transparent",
              borderRadius:0}}
            onClick={()=>setActiveTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* ══════════ SCANNER TAB ══════════ */}
      {activeTab==="scanner"&&(
        <div style={{padding:"10px 16px"}}>
          <div style={{display:"flex",gap:6,marginBottom:8,alignItems:"center",flexWrap:"wrap"}}>
            <input placeholder="Search…" value={search} style={{width:120}}
              onChange={e=>setSearch(e.target.value)}/>
            {["ALL","SIGNALS","LONG","SHORT"].map(f=>(
              <button key={f} className="btn"
                style={{background:filter===f?C.accent:C.border,color:filter===f?"#000":C.text,
                  padding:"3px 9px",fontSize:10}}
                onClick={()=>setFilter(f)}>{f}</button>
            ))}
            <span style={{fontSize:9,color:C.textDim}}>{filteredPairs.length} pairs</span>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"115px 95px 65px 55px 55px 68px 82px",
            padding:"4px 12px",borderBottom:`1px solid ${C.border}`,fontSize:9,color:C.textDim,fontWeight:700}}>
            <div>PAIR</div><div style={{textAlign:"right"}}>PRICE</div>
            <div style={{textAlign:"right"}}>24H</div><div style={{textAlign:"right"}}>RSI</div>
            <div style={{textAlign:"right"}}>SIG</div><div style={{textAlign:"right"}}>CONF</div>
            <div style={{textAlign:"right"}}>CHART</div>
          </div>

          <div style={{maxHeight:"calc(100vh - 360px)",overflowY:"auto"}}>
            {filteredPairs.map(p=>(
              <CoinRow key={p} tk={tickers[p]} opp={oppMap[p]}
                priceHist={priceHists[p]||[]} selected={selected===p}
                onClick={()=>setSelected(selected===p?null:p)}/>
            ))}
          </div>

          {selected&&tickers[selected]&&(
            <div className="fi" style={{marginTop:10,background:C.panel,border:`1px solid ${C.border}`,
              borderRadius:8,padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontWeight:700,fontSize:13}}>{selected}</span>
                <button className="btn" style={{background:"transparent",color:C.textDim,fontSize:12,padding:"0 6px"}}
                  onClick={()=>setSelected(null)}>×</button>
              </div>
              {oppMap[selected]
                ? <OppCard opp={oppMap[selected]} isLive={isLive} onTrade={executeTrade} disabled={scanning}/>
                : <div style={{color:C.textDim,fontSize:11}}>No signal for {selected} — run a scan first.</div>
              }
            </div>
          )}
        </div>
      )}

      {/* ══════════ SIGNALS TAB ══════════ */}
      {activeTab==="opportunities"&&(
        <div style={{padding:"10px 16px"}}>
          {!scanResult?(
            <div style={{textAlign:"center",padding:"40px 20px"}}>
              <div style={{fontSize:32,marginBottom:10}}>🔍</div>
              <div style={{color:C.textDim,fontSize:12,marginBottom:14}}>
                No scan yet. Click SCAN ALL to find opportunities across all {ALL_PAIRS.length} pairs.
              </div>
              <button className="btn" style={{background:C.accent,color:"#000",padding:"9px 22px",fontSize:12}}
                onClick={scanAll} disabled={scanning}>
                {scanning?<span className="pulse">Scanning…</span>:`⚡ Scan All ${ALL_PAIRS.length} Pairs`}
              </button>
            </div>
          ):(
            <>
              <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{fontSize:9,color:C.textDim}}>Sort:</span>
                {[["confidence","Confidence"],["rr","R:R"],["profit","Exp%"],["priority","Priority"]].map(([k,l])=>(
                  <button key={k} className="btn"
                    style={{background:sortBy===k?C.accent:C.border,color:sortBy===k?"#000":C.text,
                      padding:"3px 8px",fontSize:10}}
                    onClick={()=>setSortBy(k)}>{l}</button>
                ))}
                {isLive&&<span style={{marginLeft:4,color:C.bull,fontSize:10,fontWeight:700}}>🔴 LIVE EXECUTION ON</span>}
              </div>
              <div style={{maxHeight:"calc(100vh - 280px)",overflowY:"auto"}}>
                {sortedOpps.length===0
                  ? <div style={{color:C.textDim,fontSize:11,textAlign:"center",padding:20}}>No opportunities found.</div>
                  : sortedOpps.map((o,i)=>(
                    <OppCard key={i} opp={o} isLive={isLive} onTrade={executeTrade} disabled={scanning}/>
                  ))
                }
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════ TRADES TAB ══════════ */}
      {activeTab==="trades"&&(
        <div style={{padding:"10px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
            <span style={{fontSize:11,color:C.accent,fontWeight:700}}>TRADE HISTORY</span>
            <div style={{display:"flex",gap:14,fontSize:10}}>
              <span style={{color:C.bull}}>W: {winCount}</span>
              <span style={{color:C.bear}}>L: {lossCount}</span>
              {winCount+lossCount>0&&(
                <span style={{color:C.accent}}>
                  WR: {fmt((winCount/(winCount+lossCount))*100)}%
                </span>
              )}
              <span style={{color:pnl>=0?C.bull:C.bear,fontWeight:700}}>
                Net: {pnl>=0?"+":""}{inr(pnl)}
              </span>
            </div>
          </div>
          <div style={{maxHeight:"calc(100vh - 240px)",overflowY:"auto"}}>
            {trades.length===0
              ? <div style={{textAlign:"center",padding:"40px 20px",color:C.textDim,fontSize:11}}>
                  No trades yet. Scan and execute opportunities.
                </div>
              : trades.map((t,i)=><TradeCard key={i} t={t}/>)
            }
          </div>
        </div>
      )}

      {/* ══════════ LOG TAB ══════════ */}
      {activeTab==="log"&&(
        <div style={{padding:"10px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
            <span style={{fontSize:11,color:C.accent,fontWeight:700}}>ACTIVITY LOG</span>
            <button className="btn" style={{background:C.border,color:C.textDim,padding:"2px 7px",fontSize:9}}
              onClick={()=>setLog([])}>CLEAR</button>
          </div>
          <div style={{maxHeight:"calc(100vh - 230px)",overflowY:"auto",background:C.panel,
            border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 11px"}}>
            {log.length===0
              ? <div style={{color:C.textDim,fontSize:10}}>No activity yet.</div>
              : log.map((l,i)=>(
                <div key={i} style={{fontSize:10,lineHeight:1.9,
                  color:l.type==="bull"?C.bull:l.type==="bear"?C.bear:l.type==="warn"?C.warn:C.textDim}}>
                  <span style={{color:C.muted}}>{l.t} </span>{l.msg}
                </div>
              ))
            }
          </div>
        </div>
      )}

      <div style={{textAlign:"center",padding:"8px",fontSize:9,color:C.muted,borderTop:`1px solid ${C.border}`}}>
        APEX · {isLive?"🔴 LIVE TRADING":"📝 PAPER MODE"} · Local Analysis · Not financial advice · Trade at your own risk
      </div>
    </div>
  );
}
