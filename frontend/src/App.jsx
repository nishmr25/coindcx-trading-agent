import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";

// ─── Theme ──────────────────────────────────────────────────────────────────
const C = {
  bg:"#050810", panel:"#0b0f1e", card:"#0e1525", border:"#1a2240",
  accent:"#00f5c4", warn:"#ff6b35", bull:"#00e676",
  bear:"#ff3d57", muted:"#4a5580", text:"#cdd6f4", textDim:"#6272a4",
};

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const inr = (n) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
const fmt = (n, d = 2) => Number(n).toFixed(d);

// ─── Components ─────────────────────────────────────────────────────────────

function AuthPage({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [tempUserId, setTempUserId] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (twoFactorRequired) {
        const res = await axios.post(`${API_BASE}/auth/login/verify-2fa`, { userId: tempUserId, code: twoFactorCode });
        onLogin(res.data.token, res.data.user);
      } else {
        const endpoint = isRegister ? "/auth/register" : "/auth/login";
        const res = await axios.post(`${API_BASE}${endpoint}`, { email, password });
        if (res.data.twoFactorRequired) {
          setTwoFactorRequired(true);
          setTempUserId(res.data.userId);
        } else {
          onLogin(res.data.token, res.data.user);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || "Authentication failed");
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: C.bg }}>
      <div style={{ background: C.panel, padding: 30, borderRadius: 12, border: `1px solid ${C.border}`, width: 350 }}>
        <h2 style={{ color: C.accent, textAlign: "center", marginBottom: 20 }}>APEX FUND</h2>
        
        {twoFactorRequired ? (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            <div style={{ textAlign: "center", color: C.text, marginBottom: 10 }}>Enter Authenticator Code</div>
            <input type="text" placeholder="6-digit code" value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value)} required style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: 10, borderRadius: 5, textAlign: "center", fontSize: 18, letterSpacing: 5 }} />
            {error && <div style={{ color: C.bear, fontSize: 12 }}>{error}</div>}
            <button type="submit" style={{ background: C.accent, color: "#000", border: "none", padding: 12, borderRadius: 5, fontWeight: "bold", cursor: "pointer" }}>VERIFY & LOGIN</button>
            <button type="button" onClick={() => setTwoFactorRequired(false)} style={{ background: "transparent", color: C.textDim, border: "none", cursor: "pointer" }}>Back to Login</button>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: 10, borderRadius: 5 }} />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: 10, borderRadius: 5 }} />
              {error && <div style={{ color: C.bear, fontSize: 12 }}>{error}</div>}
              <button type="submit" style={{ background: C.accent, color: "#000", border: "none", padding: 12, borderRadius: 5, fontWeight: "bold", cursor: "pointer" }}>
                {isRegister ? "CREATE ACCOUNT" : "LOGIN"}
              </button>
            </form>
            
            <div style={{ margin: "20px 0", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: C.border }}></div>
              <div style={{ color: C.textDim, fontSize: 11 }}>OR</div>
              <div style={{ flex: 1, height: 1, background: C.border }}></div>
            </div>

            <button onClick={handleGoogleLogin} style={{ width: "100%", background: "#fff", color: "#000", border: "none", padding: 12, borderRadius: 5, fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84c-.21.1-.37.19-.51.27l.51-.27c-.88 2.6-3.43 4.47-6.33 4.47-3.6 0-6.52-2.92-6.52-6.52S3.4 2.01 7 2.01c1.73 0 3.3.61 4.5 1.62l2.6-2.6C12.1.84 9.68 0 7 0 3.13 0 0 3.13 0 7s3.13 7 7 7c4.04 0 6.72-2.84 6.72-6.84 0-.41-.04-.81-.08-1.21h-2.12z" fill="#4285F4"/></svg>
              CONTINUE WITH GOOGLE
            </button>

            <div style={{ textAlign: "center", marginTop: 20, color: C.textDim, fontSize: 13 }}>
              {isRegister ? "Already have an account?" : "Don't have an account?"}
              <span onClick={() => setIsRegister(!isRegister)} style={{ color: C.accent, marginLeft: 5, cursor: "pointer" }}>
                {isRegister ? "Login" : "Sign Up"}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [activeTab, setActiveTab] = useState("wallet");
  const [balanceData, setBalanceData] = useState({ balance: 0, totalProfit: 0, transactions: [] });
  const [trades, setTrades] = useState([]);
  const [qrCode, setQrCode] = useState(null);
  const [twoFactorVerifyCode, setTwoFactorVerifyCode] = useState("");

  const fetchUserData = useCallback(async () => {
    if (!token) return;
    try {
      const [balRes, tradesRes] = await Promise.all([
        axios.get(`${API_BASE}/wallet/balance`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_BASE}/trades`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setBalanceData(balRes.data);
      setTrades(tradesRes.data);
    } catch (err) {
      if (err.response?.status === 401) handleLogout();
    }
  }, [token]);

  useEffect(() => {
    // Handle Google Auth Success or Stripe Payment Success
    const urlParams = new URLSearchParams(window.location.search);
    const t = urlParams.get('token');
    if (t) {
      handleLogin(t, { email: urlParams.get('email'), id: urlParams.get('id') });
      window.history.replaceState({}, document.title, "/");
    }

    if (urlParams.get('success')) {
      alert("Payment successful! Your balance will update shortly.");
      window.history.replaceState({}, document.title, "/");
      fetchUserData();
    }
  }, [fetchUserData]);

  const handleLogin = (t, u) => {
    setToken(t);
    setUser(u);
    localStorage.setItem("token", t);
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
  };

  const setup2FA = async () => {
    try {
      const res = await axios.get(`${API_BASE}/auth/2fa/generate`, { headers: { Authorization: `Bearer ${token}` } });
      setQrCode(res.data.qrCodeUrl);
    } catch (err) { alert("Failed to generate 2FA"); }
  };

  const enable2FA = async () => {
    try {
      await axios.post(`${API_BASE}/auth/2fa/enable`, { code: twoFactorVerifyCode }, { headers: { Authorization: `Bearer ${token}` } });
      alert("2FA enabled successfully!");
      setQrCode(null);
      setTwoFactorVerifyCode("");
      fetchUserData();
    } catch (err) { alert(err.response?.data?.message || "Verification failed"); }
  };

  const handleDeposit = async () => {
    const amt = prompt("Enter deposit amount (₹):");
    if (!amt || isNaN(amt) || parseFloat(amt) < 100) return alert("Minimum deposit is ₹100");
    try {
      const res = await axios.post(`${API_BASE}/wallet/create-checkout-session`, { amount: amt }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err) { alert("Failed to initiate deposit: " + err.message); }
  };

  const handleWithdraw = async () => {
    const amt = prompt("Enter withdrawal amount (₹):");
    if (!amt || isNaN(amt)) return;
    try {
      const res = await axios.post(`${API_BASE}/wallet/withdraw`, { amount: amt }, { headers: { Authorization: `Bearer ${token}` } });
      alert(res.data.message || "Withdrawal request submitted!");
      fetchUserData();
    } catch (err) { alert(err.response?.data?.message || "Failed"); }
  };

  if (!token) return <AuthPage onLogin={handleLogin} />;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
      <style>{`
        .btn { cursor:pointer; border:none; border-radius:5px; font-weight:700; padding:8px 16px; transition: opacity .2s; }
        .btn:hover { opacity: 0.8; }
        .tab { cursor:pointer; padding:12px 24px; border:none; background:transparent; color: ${C.textDim}; font-weight:700; border-bottom: 2px solid transparent; }
        .tab-active { color: ${C.accent}; border-bottom-color: ${C.accent}; }
      `}</style>

      {/* HEADER */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "15px 25px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.accent, letterSpacing: -1 }}>APEX POOLED FUND</div>
          <div style={{ fontSize: 10, color: C.textDim }}>AUTOMATED MULTI-USER TRADING PLATFORM</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: C.textDim }}>YOUR BALANCE</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.bull }}>{inr(balanceData.balance)}</div>
          </div>
          <button onClick={handleLogout} className="btn" style={{ background: `${C.bear}22`, color: C.bear, fontSize: 11 }}>LOGOUT</button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}`, padding: "0 25px", display: "flex", gap: 10 }}>
        {["wallet", "performance", "fund-trades", "settings"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`tab ${activeTab === t ? "tab-active" : ""}`}>
            {t.toUpperCase().replace("-", " ")}
          </button>
        ))}
      </div>

      <div style={{ padding: "30px 25px" }}>
        {activeTab === "wallet" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>
            <div style={{ background: C.panel, padding: 25, borderRadius: 10, border: `1px solid ${C.border}` }}>
              <h3 style={{ marginBottom: 20, color: C.accent }}>Wallet Management</h3>
              <div style={{ display: "flex", gap: 15, marginBottom: 30 }}>
                <button onClick={handleDeposit} className="btn" style={{ background: C.bull, color: "#000", flex: 1 }}>DEPOSIT FUNDS</button>
                <button onClick={handleWithdraw} className="btn" style={{ background: C.warn, color: "#000", flex: 1 }}>WITHDRAW FUNDS</button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "15px 0", borderBottom: `1px solid ${C.border}44` }}>
                <span style={{ color: C.textDim }}>Initial Capital</span>
                <span>{inr(balanceData.balance - balanceData.totalProfit)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "15px 0", borderBottom: `1px solid ${C.border}44` }}>
                <span style={{ color: C.textDim }}>Total Net Profit (after 30% comm.)</span>
                <span style={{ color: C.bull }}>{inr(balanceData.totalProfit)}</span>
              </div>
            </div>

            <div style={{ background: C.panel, padding: 25, borderRadius: 10, border: `1px solid ${C.border}` }}>
              <h3 style={{ marginBottom: 20, color: C.accent }}>Recent Transactions</h3>
              {balanceData.transactions.length === 0 ? <div style={{ color: C.textDim }}>No transactions yet.</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {balanceData.transactions.map((tx, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: tx.type === 'DEPOSIT' ? C.bull : C.warn }}>{tx.type}</span>
                      <span>{inr(tx.amount)}</span>
                      <span style={{ color: C.textDim }}>{new Date(tx.timestamp).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div style={{ background: C.panel, padding: 30, borderRadius: 10, border: `1px solid ${C.border}`, maxWidth: 500, margin: "0 auto" }}>
            <h3 style={{ marginBottom: 20, color: C.accent }}>Security Settings</h3>
            <div style={{ padding: "20px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ fontWeight: "bold" }}>Two-Factor Authentication</div>
                  <div style={{ fontSize: 11, color: C.textDim }}>Secure your account with Google Authenticator</div>
                </div>
                {!qrCode && <button onClick={setup2FA} className="btn" style={{ background: C.accent, color: "#000", fontSize: 11 }}>SETUP 2FA</button>}
              </div>

              {qrCode && (
                <div style={{ textAlign: "center", background: "#fff", padding: 20, borderRadius: 10 }}>
                  <div style={{ color: "#000", fontSize: 12, marginBottom: 15, fontWeight: "bold" }}>Scan this QR code with Google Authenticator</div>
                  <img src={qrCode} alt="2FA QR Code" style={{ width: 200, height: 200 }} />
                  <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "center" }}>
                    <input type="text" placeholder="Enter 6-digit code" value={twoFactorVerifyCode} onChange={e => setTwoFactorVerifyCode(e.target.value)} style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: 8, borderRadius: 5, width: 150, textAlign: "center" }} />
                    <button onClick={enable2FA} className="btn" style={{ background: C.bull, color: "#000" }}>VERIFY</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "performance" && (
          <div style={{ background: C.panel, padding: 30, borderRadius: 10, border: `1px solid ${C.border}`, textAlign: "center" }}>
            <h2 style={{ color: C.accent }}>Performance Overview</h2>
            <div style={{ display: "flex", justifyContent: "space-around", marginTop: 40 }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 900, color: C.bull }}>{fmt((balanceData.totalProfit / (balanceData.balance - balanceData.totalProfit || 1)) * 100)}%</div>
                <div style={{ color: C.textDim, fontSize: 11, marginTop: 5 }}>TOTAL ROI</div>
              </div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 900, color: C.text }}>30%</div>
                <div style={{ color: C.textDim, fontSize: 11, marginTop: 5 }}>PROFIT COMMISSION</div>
              </div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 900, color: C.accent }}>{trades.length}</div>
                <div style={{ color: C.textDim, fontSize: 11, marginTop: 5 }}>FUND TRADES</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "fund-trades" && (
          <div style={{ background: C.panel, padding: 25, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <h3 style={{ marginBottom: 20, color: C.accent }}>Global Fund Trade History</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr", padding: "10px 0", borderBottom: `1px solid ${C.border}`, color: C.textDim, fontSize: 11 }}>
              <span>PAIR</span><span>SIGNAL</span><span>ENTRY</span><span>PNL (GROSS)</span><span>COMMISSION (30%)</span><span>TIME</span>
            </div>
            <div style={{ maxHeight: 400, overflowY: "auto", marginTop: 10 }}>
              {trades.map((t, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr", padding: "12px 0", borderBottom: `1px solid ${C.border}22`, fontSize: 12 }}>
                  <span style={{ fontWeight: "bold" }}>{t.pair}</span>
                  <span style={{ color: t.signal === 'LONG' ? C.bull : C.bear }}>{t.signal}</span>
                  <span>{inr(t.entry)}</span>
                  <span style={{ color: t.pnl >= 0 ? C.bull : C.bear }}>{t.pnl >= 0 ? "+" : ""}{inr(t.pnl)}</span>
                  <span style={{ color: C.warn }}>{inr(t.commissionTaken)}</span>
                  <span style={{ color: C.textDim }}>{new Date(t.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
              {trades.length === 0 && <div style={{ padding: 20, textAlign: "center", color: C.textDim }}>Waiting for fund to execute trades...</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
