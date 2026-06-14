import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import axios from "axios";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars, MeshDistortMaterial, Text, PerspectiveCamera, OrbitControls } from "@react-three/drei";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, TrendingUp, History, Settings, LogOut, Shield, ChevronRight, Zap, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import * as THREE from "three";

// ─── Sci-Fi Theme ───────────────────────────────────────────────────────────
const C = {
  bg: "#02040a",
  panel: "rgba(10, 15, 28, 0.7)",
  card: "rgba(16, 22, 42, 0.6)",
  border: "#1e293b",
  accent: "#00f5c4",
  accentGlow: "rgba(0, 245, 196, 0.3)",
  warn: "#ff6b35",
  bull: "#00ff88",
  bear: "#ff3d57",
  text: "#f1f5f9",
  textDim: "#94a3b8",
};

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const inr = (n) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

// ─── 3D Components ──────────────────────────────────────────────────────────

function BackgroundScene() {
  return (
    <>
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 10, 10]} color={C.accent} intensity={1} />
      <gridHelper args={[100, 50, "#1e293b", "#0f172a"]} rotation={[Math.PI / 2.5, 0, 0]} position={[0, -10, 0]} />
    </>
  );
}

function FloatingCore() {
  const mesh = useRef();
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (mesh.current) {
      mesh.current.rotation.x = Math.cos(t / 4) / 8;
      mesh.current.rotation.y = Math.sin(t / 4) / 8;
      mesh.current.position.y = Math.sin(t / 2) / 10;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh ref={mesh}>
        <octahedronGeometry args={[1, 0]} />
        <MeshDistortMaterial color={C.accent} speed={3} distort={0.2} wireframe />
      </mesh>
    </Float>
  );
}

// ─── Styled UI Components ───────────────────────────────────────────────────

const GlassPanel = ({ children, style = {}, ...props }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    style={{
      background: C.panel,
      backdropFilter: "blur(12px)",
      border: `1px solid ${C.border}`,
      borderRadius: "16px",
      boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.37)`,
      overflow: "hidden",
      ...style,
    }}
    {...props}
  >
    {children}
  </motion.div>
);

const NeonButton = ({ children, color = C.accent, ...props }) => (
  <motion.button
    whileHover={{ scale: 1.02, boxShadow: `0 0 15px ${color}55` }}
    whileTap={{ scale: 0.98 }}
    style={{
      background: `${color}15`,
      border: `1px solid ${color}`,
      color: color,
      padding: "10px 20px",
      borderRadius: "8px",
      fontWeight: "700",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "12px",
      textTransform: "uppercase",
      letterSpacing: "1px",
    }}
    {...props}
  >
    {children}
  </motion.button>
);

// ─── Auth Page ──────────────────────────────────────────────────────────────

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
      setError(err.response?.data?.message || "AUTHENTICATION_FAILED");
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh", background: C.bg }}>
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <Canvas>
          <PerspectiveCamera makeDefault position={[0, 0, 5]} />
          <BackgroundScene />
          <FloatingCore />
        </Canvas>
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <GlassPanel style={{ width: "380px", padding: "40px" }}>
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} style={{ display: "inline-block", color: C.accent, marginBottom: "15px" }}>
              <Zap size={40} />
            </motion.div>
            <h1 style={{ fontSize: "24px", fontWeight: "900", color: C.accent, letterSpacing: "4px" }}>APEX FUND</h1>
            <div style={{ fontSize: "10px", color: C.textDim, letterSpacing: "2px" }}>QUANTUM TRADING PROTOCOL</div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {twoFactorRequired ? (
              <>
                <div style={{ textAlign: "center", color: C.text, fontSize: "12px", marginBottom: "5px" }}>2FA VERIFICATION REQUIRED</div>
                <input type="text" placeholder="######" value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value)} required style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, color: C.accent, padding: "12px", borderRadius: "8px", textAlign: "center", fontSize: "20px", letterSpacing: "8px" }} />
              </>
            ) : (
              <>
                <input type="email" placeholder="USER_IDENTIFIER@SECURE.COM" value={email} onChange={e => setEmail(e.target.value)} required style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, color: C.text, padding: "12px", borderRadius: "8px", fontSize: "12px" }} />
                <input type="password" placeholder="ACCESS_KEY" value={password} onChange={e => setPassword(e.target.value)} required style={{ background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, color: C.text, padding: "12px", borderRadius: "8px", fontSize: "12px" }} />
              </>
            )}
            {error && <div style={{ color: C.bear, fontSize: "10px", textAlign: "center", background: `${C.bear}15`, padding: "8px", borderRadius: "4px" }}>ERROR: {error}</div>}
            <NeonButton type="submit">{twoFactorRequired ? "ACCESS CORE" : (isRegister ? "INITIATE ACCOUNT" : "AUTHENTICATE")}</NeonButton>
          </form>

          <div style={{ margin: "25px 0", display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={{ flex: 1, height: "1px", background: C.border }}></div>
            <div style={{ color: C.textDim, fontSize: "10px" }}>EXTERNAL_LINK</div>
            <div style={{ flex: 1, height: "1px", background: C.border }}></div>
          </div>

          <button onClick={() => window.location.href = `${API_BASE}/auth/google`} style={{ width: "100%", background: "#fff", color: "#000", border: "none", padding: "12px", borderRadius: "8px", fontWeight: "900", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontSize: "11px" }}>
            <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84c-.21.1-.37.19-.51.27l.51-.27c-.88 2.6-3.43 4.47-6.33 4.47-3.6 0-6.52-2.92-6.52-6.52S3.4 2.01 7 2.01c1.73 0 3.3.61 4.5 1.62l2.6-2.6C12.1.84 9.68 0 7 0 3.13 0 0 3.13 0 7s3.13 7 7 7c4.04 0 6.72-2.84 6.72-6.84 0-.41-.04-.81-.08-1.21h-2.12z" fill="#4285F4"/></svg>
            LOGIN WITH GOOGLE
          </button>

          <div style={{ textAlign: "center", marginTop: "25px", color: C.textDim, fontSize: "11px" }}>
            {isRegister ? "REGISTERED ALREADY?" : "NEW OPERATOR?"}
            <span onClick={() => setIsRegister(!isRegister)} style={{ color: C.accent, marginLeft: "8px", cursor: "pointer", fontWeight: "700" }}>
              {isRegister ? "[ LOGIN ]" : "[ SIGN_UP ]"}
            </span>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

// ─── App Dashboard ──────────────────────────────────────────────────────────

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
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
    const urlParams = new URLSearchParams(window.location.search);
    const t = urlParams.get('token');
    if (t) {
      handleLogin(t, { email: urlParams.get('email'), id: urlParams.get('id') });
      window.history.replaceState({}, document.title, "/");
    }
    if (urlParams.get('success')) {
      alert("PAYMENT_VERIFIED: System balance will update shortly.");
      window.history.replaceState({}, document.title, "/");
      fetchUserData();
    }
  }, [fetchUserData]);

  useEffect(() => {
    if (token) fetchUserData();
    const id = setInterval(() => { if(token) fetchUserData(); }, 15000);
    return () => clearInterval(id);
  }, [token, fetchUserData]);

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

  const handleDeposit = async () => {
    const amt = prompt("ENTER_CREDIT_AMOUNT (₹):");
    if (!amt || isNaN(amt) || parseFloat(amt) < 100) return;
    try {
      const res = await axios.post(`${API_BASE}/wallet/create-checkout-session`, { amount: amt }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.url) window.location.href = res.data.url;
    } catch (err) { console.error(err); }
  };

  const handleWithdraw = async () => {
    const amt = prompt("ENTER_DEBIT_AMOUNT (₹):");
    if (!amt || isNaN(amt)) return;
    try {
      const res = await axios.post(`${API_BASE}/wallet/withdraw`, { amount: amt }, { headers: { Authorization: `Bearer ${token}` } });
      alert(res.data.message);
      fetchUserData();
    } catch (err) { alert(err.response?.data?.message); }
  };

  if (!token) return <AuthPage onLogin={handleLogin} />;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "'IBM Plex Mono', monospace", position: "relative", overflowX: "hidden" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, opacity: 0.5 }}>
        <Canvas>
          <BackgroundScene />
        </Canvas>
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* HEADER */}
        <header style={{ background: "rgba(10, 15, 28, 0.9)", borderBottom: `1px solid ${C.border}`, padding: "15px 30px", display: "flex", justifyContent: "space-between", alignItems: "center", backdropFilter: "blur(20px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={{ background: C.accent, width: "32px", height: "32px", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontWeight: "900" }}>A</div>
            <div>
              <div style={{ fontSize: "18px", fontWeight: "900", color: C.accent, letterSpacing: "2px" }}>APEX_OS</div>
              <div style={{ fontSize: "9px", color: C.textDim }}>POOLED_TRADING_V4.2</div>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: "30px", alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "9px", color: C.textDim }}>ACTIVE_BALANCE</div>
              <div style={{ fontSize: "18px", fontWeight: "700", color: C.accent }}>{inr(balanceData.balance)}</div>
            </div>
            <button onClick={handleLogout} style={{ background: "transparent", border: `1px solid ${C.bear}`, color: C.bear, padding: "6px 12px", borderRadius: "4px", fontSize: "10px", cursor: "pointer", fontWeight: "700" }}>TERMINATE</button>
          </div>
        </header>

        <main style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
          {/* NAV TABS */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "30px" }}>
            {[
              { id: "wallet", label: "WALLET", icon: Wallet },
              { id: "performance", label: "METRICS", icon: TrendingUp },
              { id: "fund-trades", label: "LEDGER", icon: History },
              { id: "settings", label: "SECURITY", icon: Settings },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                background: activeTab === tab.id ? `${C.accent}15` : "transparent",
                border: `1px solid ${activeTab === tab.id ? C.accent : C.border}`,
                color: activeTab === tab.id ? C.accent : C.textDim,
                padding: "10px 20px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px", fontSize: "11px", fontWeight: "700", cursor: "pointer", transition: "all 0.3s"
              }}>
                <tab.icon size={16} /> {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "wallet" && (
              <motion.div key="wallet" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
                <GlassPanel style={{ padding: "30px" }}>
                  <h3 style={{ color: C.accent, marginBottom: "20px", fontSize: "14px" }}>WALLET_CONTROLS</h3>
                  <div style={{ display: "flex", gap: "15px", marginBottom: "30px" }}>
                    <NeonButton onClick={handleDeposit} color={C.bull} style={{ flex: 1 }}><ArrowDownLeft size={16} /> CREDIT</NeonButton>
                    <NeonButton onClick={handleWithdraw} color={C.warn} style={{ flex: 1 }}><ArrowUpRight size={16} /> DEBIT</NeonButton>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "12px", borderBottom: `1px solid ${C.border}44` }}>
                      <span style={{ color: C.textDim }}>INITIAL_CAPITAL</span>
                      <span>{inr(balanceData.balance - balanceData.totalProfit)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "12px", borderBottom: `1px solid ${C.border}44` }}>
                      <span style={{ color: C.textDim }}>NET_REVENUE</span>
                      <span style={{ color: C.bull }}>{inr(balanceData.totalProfit)}</span>
                    </div>
                  </div>
                </GlassPanel>

                <GlassPanel style={{ padding: "30px" }}>
                  <h3 style={{ color: C.accent, marginBottom: "20px", fontSize: "14px" }}>TRANSACTION_LOG</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {balanceData.transactions.map((tx, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: "rgba(0,0,0,0.2)", borderRadius: "6px", fontSize: "11px" }}>
                        <span style={{ color: tx.type === 'DEPOSIT' ? C.bull : C.warn }}>{tx.type}</span>
                        <span style={{ fontWeight: "700" }}>{inr(tx.amount)}</span>
                        <span style={{ color: C.textDim }}>{new Date(tx.timestamp).toLocaleDateString()}</span>
                      </div>
                    ))}
                    {balanceData.transactions.length === 0 && <div style={{ color: C.textDim, textAlign: "center", padding: "20px" }}>NO_DATA_FOUND</div>}
                  </div>
                </GlassPanel>
              </motion.div>
            )}

            {activeTab === "performance" && (
              <motion.div key="perf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <GlassPanel style={{ padding: "40px", textAlign: "center" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "40px" }}>
                    <div>
                      <div style={{ fontSize: "40px", fontWeight: "900", color: C.bull }}>{((balanceData.totalProfit / (balanceData.balance - balanceData.totalProfit || 1)) * 100).toFixed(2)}%</div>
                      <div style={{ fontSize: "10px", color: C.textDim, marginTop: "10px" }}>ACCUMULATED_ROI</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "40px", fontWeight: "900", color: C.text }}>30.00%</div>
                      <div style={{ fontSize: "10px", color: C.textDim, marginTop: "10px" }}>PROTOCOL_FEE</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "40px", fontWeight: "900", color: C.accent }}>{trades.length}</div>
                      <div style={{ fontSize: "10px", color: C.textDim, marginTop: "10px" }}>EXECUTED_OPERATIONS</div>
                    </div>
                  </div>
                </GlassPanel>
              </motion.div>
            )}

            {activeTab === "fund-trades" && (
              <motion.div key="fund" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <GlassPanel style={{ padding: "30px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 2fr 1.5fr", padding: "0 10px 15px", borderBottom: `1px solid ${C.border}`, color: C.textDim, fontSize: "10px" }}>
                    <span>IDENTIFIER</span><span>SIDE</span><span>ENTRY</span><span>PNL_GROSS</span><span>TIME</span>
                  </div>
                  <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                    {trades.map((t, i) => (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 2fr 1.5fr", padding: "15px 10px", borderBottom: `1px solid ${C.border}22`, fontSize: "12px", alignItems: "center" }}>
                        <span style={{ fontWeight: "700" }}>{t.pair}</span>
                        <span style={{ color: t.signal === 'LONG' ? C.bull : C.bear }}>{t.signal}</span>
                        <span style={{ fontSize: "11px" }}>{inr(t.entry)}</span>
                        <span style={{ color: t.pnl >= 0 ? C.bull : C.bear, fontWeight: "700" }}>{t.pnl >= 0 ? "+" : ""}{inr(t.pnl)}</span>
                        <span style={{ color: C.textDim, fontSize: "10px" }}>{new Date(t.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </GlassPanel>
              </motion.div>
            )}

            {activeTab === "settings" && (
              <motion.div key="set" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                <GlassPanel style={{ padding: "40px", maxWidth: "600px", margin: "0 auto" }}>
                  <div style={{ display: "flex", gap: "20px", alignItems: "center", marginBottom: "30px" }}>
                    <Shield size={32} color={C.accent} />
                    <h3 style={{ color: C.accent, fontSize: "16px" }}>SECURITY_PROTOCOLS</h3>
                  </div>

                  {!qrCode ? (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "20px", borderRadius: "12px" }}>
                      <div>
                        <div style={{ fontWeight: "700", marginBottom: "5px" }}>2FA_AUTHENTICATOR</div>
                        <div style={{ fontSize: "11px", color: C.textDim }}>ENABLE TOTP LAYER FOR WITHDRAWALS</div>
                      </div>
                      <NeonButton onClick={async () => {
                        try {
                          const res = await axios.get(`${API_BASE}/auth/2fa/generate`, { headers: { Authorization: `Bearer ${token}` } });
                          setQrCode(res.data.qrCodeUrl);
                        } catch(e) { alert("2FA_GEN_FAILED"); }
                      }}>ACTIVATE</NeonButton>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", background: "#fff", padding: "30px", borderRadius: "16px" }}>
                      <div style={{ color: "#000", fontSize: "11px", fontWeight: "900", marginBottom: "20px" }}>SCAN_CODE_VIA_AUTHENTICATOR_APP</div>
                      <img src={qrCode} alt="2FA" style={{ width: "200px", border: "8px solid #f1f5f9" }} />
                      <div style={{ marginTop: "25px", display: "flex", gap: "10px", justifyContent: "center" }}>
                        <input type="text" placeholder="######" value={twoFactorVerifyCode} onChange={e => setTwoFactorVerifyCode(e.target.value)} style={{ background: "#f1f5f9", border: `2px solid ${C.border}`, color: "#000", padding: "12px", borderRadius: "8px", width: "120px", textAlign: "center", fontWeight: "900" }} />
                        <button onClick={async () => {
                          try {
                            await axios.post(`${API_BASE}/auth/2fa/enable`, { code: twoFactorVerifyCode }, { headers: { Authorization: `Bearer ${token}` } });
                            alert("2FA_LOCKED");
                            setQrCode(null);
                            fetchUserData();
                          } catch (e) { alert("VERIFICATION_FAILED"); }
                        }} style={{ background: "#000", color: "#fff", border: "none", padding: "12px 24px", borderRadius: "8px", fontWeight: "900", cursor: "pointer" }}>VERIFY</button>
                      </div>
                    </div>
                  )}
                </GlassPanel>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <footer style={{ position: "fixed", bottom: 0, width: "100%", padding: "10px 30px", fontSize: "9px", color: C.textDim, display: "flex", justifyContent: "space-between", background: "rgba(2, 4, 10, 0.8)", borderTop: `1px solid ${C.border}` }}>
        <div>SYSTEM_STATUS: <span style={{ color: C.bull }}>STABLE</span></div>
        <div>LATENCY: 24MS</div>
        <div>© 2026 APEX_QUANTUM_CORE</div>
      </footer>
    </div>
  );
}
