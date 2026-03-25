import { useState, useEffect, useCallback, useRef } from "react";

const INIT = [
  { id: "1", name: "Philip", type: "client" },
  { id: "2", name: "Ami Deane", type: "client" },
  { id: "3", name: "Alek Angelov", type: "client" },
  { id: "4", name: "Vantage Capital", type: "client" },
  { id: "5", name: "Anthony", type: "client" },
  { id: "6", name: "Carter", type: "client" },
  { id: "7", name: "Patrick", type: "client" },
  { id: "8", name: "Danny / Katya", type: "client" },
  { id: "10", name: "Gabe Ravetz", type: "client" },
  { id: "11", name: "Athletic Freedom", type: "client" },
  { id: "12", name: "Brayden", type: "client" },
  { id: "13", name: "Chris", type: "client" },
  { id: "14", name: "Luke", type: "client" },
  { id: "15", name: "Ivy", type: "client" },
  { id: "16", name: "Harrison", type: "client" },
  { id: "17", name: "Adam", type: "client" },
  { id: "18", name: "John", type: "client" },
  { id: "19", name: "Salt Cinema", type: "client" },
  { id: "20", name: "Tristan", type: "client" },
  { id: "21", name: "Daniel (AirTech)", type: "client" },
  { id: "22", name: "Tom Cox", type: "client" },
  { id: "23", name: "Toby", type: "client" },
  { id: "24", name: "Danielle Bradley", type: "client" },
  { id: "25", name: "Chelsea Mau", type: "client" },
  { id: "26", name: "Alex", type: "client" },
  { id: "27", name: "CADDIX", type: "client" },
  { id: "t1", name: "Maria", type: "team" },
  { id: "t2", name: "Anastasiia", type: "team" },
];

const RKEYS = ["client_morning", "client_evening", "internal_morning", "internal_evening"];
const RLABELS = { client_morning: "Client Morning", client_evening: "Client Evening", internal_morning: "Internal Morning", internal_evening: "Internal Evening" };
const RTIME = k => k.includes("morning") ? "morning" : "evening";

const PT = { EARLY: 10, ON_TIME: 8, LATE: 5, VERY_LATE: 2, MISSED: 0, STREAK: 3 };
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MO = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MOS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Storage helpers using localStorage
const store = {
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  getRaw: (k) => localStorage.getItem(k),
  setRaw: (k, v) => localStorage.setItem(k, v),
};
const SK = { R: "dr-roster", S: "dr-subs", P: "dr-pin" };

function ukNow() { return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Kyiv" })); }
function ukDate() { return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" }); }
function ukTime() { return new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/Kyiv", hour: "2-digit", minute: "2-digit" }); }
function fT(iso) { if (!iso) return ""; return new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/Kyiv", hour: "2-digit", minute: "2-digit" }); }
function fFull(ds) { const d = new Date(ds + "T12:00:00"); return `${DAYS[d.getDay()]}, ${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }
function fShort(ds) { const d = new Date(ds + "T12:00:00"); return `${DAYS[d.getDay()].slice(0,3)}, ${MOS[d.getMonth()]} ${d.getDate()}`; }
function shD(ds, n) { const d = new Date(ds + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().split("T")[0]; }

function cP(iso, rkey) {
  if (!iso) return PT.MISSED;
  const s = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "Europe/Kyiv" }));
  const m = s.getHours() * 60 + s.getMinutes();
  const dl = RTIME(rkey) === "morning" ? 660 : 1440;
  const diff = m - dl;
  if (diff <= -60) return PT.EARLY; if (diff <= 0) return PT.ON_TIME; if (diff <= 120) return PT.LATE;
  return PT.VERY_LATE;
}

function pL(p) {
  if (p === 10) return { t: "EARLY", c: "#00ffab", i: "⚡" };
  if (p === 8) return { t: "ON TIME", c: "#4ecdc4", i: "✓" };
  if (p === 5) return { t: "LATE", c: "#f0b429", i: "⏰" };
  if (p === 2) return { t: "VERY LATE", c: "#ff6b6b", i: "😬" };
  return { t: "MISSED", c: "#4a4a5a", i: "✗" };
}

function gStreak(pid, subs, today) {
  let s = 0, d = new Date(today); d.setDate(d.getDate() - 1);
  while (true) {
    const ds = d.toISOString().split("T")[0]; const day = subs[ds];
    if (!day || !day[pid]) break;
    const allOk = RKEYS.every(k => { const v = day[pid]?.[k]; return v && cP(v, k) >= 8; });
    if (allOk) { s++; d.setDate(d.getDate() - 1); } else break;
  }
  return s;
}

function gDayPts(pid, daySubs) {
  if (!daySubs?.[pid]) return 0;
  return RKEYS.reduce((t, k) => t + (daySubs[pid]?.[k] ? cP(daySubs[pid][k], k) : 0), 0);
}

function gTotal(pid, subs, today) {
  let t = 0;
  for (const ds of Object.keys(subs)) t += gDayPts(pid, subs[ds]);
  t += gStreak(pid, subs, today) * PT.STREAK; return t;
}

function gWeek(pid, subs) {
  const today = new Date(ukDate()); const dow = today.getDay(); const mon = new Date(today); mon.setDate(today.getDate() - ((dow + 6) % 7));
  let t = 0;
  for (let d = new Date(mon); d <= today; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().split("T")[0]; if (subs[ds]) t += gDayPts(pid, subs[ds]);
  }
  return t;
}

function countSubs(roster, ts, rkey) { return roster.filter(r => ts[r.id]?.[rkey]).length; }

const RK = [
  { bg: "linear-gradient(135deg, #f0b429, #f7d070)", b: "#f0b429", t: "#1a1a2e", badge: "👑" },
  { bg: "linear-gradient(135deg, #a0aec0, #cbd5e1)", b: "#a0aec0", t: "#1a1a2e", badge: "🥈" },
  { bg: "linear-gradient(135deg, #c4956a, #deb891)", b: "#c4956a", t: "#1a1a2e", badge: "🥉" },
];

export default function App() {
  const [roster, setRoster] = useState([]);
  const [subs, setSubs] = useState({});
  const [pin, setPin] = useState("2026");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [time, setTime] = useState(ukTime());

  useEffect(() => { const t = setInterval(() => setTime(ukTime()), 30000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const r = store.get(SK.R);
    const s = store.get(SK.S);
    const p = store.getRaw(SK.P);
    if (r) setRoster(r); else { setRoster(INIT); store.set(SK.R, INIT); }
    if (s) setSubs(s);
    if (p) setPin(p);
    setLoading(false);
  }, []);

  // Poll for changes from other tabs
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === SK.S) { try { setSubs(JSON.parse(e.newValue)); } catch {} }
      if (e.key === SK.R) { try { setRoster(JSON.parse(e.newValue)); } catch {} }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const svR = useCallback(r => { setRoster(r); store.set(SK.R, r); }, []);
  const svS = useCallback(s => { setSubs(s); store.set(SK.S, s); }, []);
  const svP = useCallback(p => { setPin(p); store.setRaw(SK.P, p); }, []);

  if (loading) return <Shell><div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh" }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 44, marginBottom: 12, animation: "pulse 1.5s infinite" }}>📊</div><div style={{ fontSize: 13, opacity: 0.5 }}>Loading...</div></div></div></Shell>;
  if (!user) return <Landing roster={roster} subs={subs} pin={pin} onLogin={setUser} time={time} />;
  if (user === "admin") return <Admin roster={roster} subs={subs} setRoster={svR} setSubs={svS} pin={pin} svP={svP} onOut={() => setUser(null)} time={time} />;
  return <UserD user={user} roster={roster} subs={subs} svS={svS} onOut={() => setUser(null)} time={time} />;
}

/* ============================================================ */
/*  LANDING                                                      */
/* ============================================================ */
function Landing({ roster, subs, pin, onLogin, time }) {
  const [view, setView] = useState("home");
  const [search, setSearch] = useState("");
  const [pinVal, setPinVal] = useState("");
  const [pinErr, setPinErr] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(true);

  const today = ukDate(); const ts = subs[today] || {};

  const lb = roster.map(p => ({
    ...p, points: gTotal(p.id, subs, today), stk: gStreak(p.id, subs, today),
    done: RKEYS.filter(k => ts[p.id]?.[k]).length,
  })).sort((a, b) => b.points - a.points);

  const tryAdmin = () => { if (pinVal === pin) onLogin("admin"); else { setPinErr(true); setTimeout(() => setPinErr(false), 1500); setPinVal(""); } };

  if (view === "login") {
    const f = search ? roster.filter(r => r.name.toLowerCase().includes(search.toLowerCase())) : roster;
    return (
      <Shell>
        <div style={{ padding: "20px 20px 40px", maxWidth: 440, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <button onClick={() => setView("home")} className="btn-s" style={backBtn}>‹</button>
            <div style={{ fontFamily: "'Sora'", fontSize: 18, fontWeight: 700 }}>Who are you?</div>
          </div>
          <p style={{ fontSize: 13, color: "#7d8590", marginBottom: 12 }}>Find your name, tap it, and submit your reports from your personal dashboard.</p>
          <input type="text" placeholder="Search your name..." value={search} onChange={e => setSearch(e.target.value)} autoFocus style={inputStyle} />
          <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
            {f.filter(r => r.type === "team").length > 0 && (<><SL text="Team" c="#f0b429" />{f.filter(r => r.type === "team").map((p, i) => <PBtn key={p.id} p={p} onClick={() => onLogin(p)} d={i} />)}<div style={{ height: 8 }} /></>)}
            <SL text={`Clients (${f.filter(r => r.type === "client").length})`} c="#4ecdc4" />
            {f.filter(r => r.type === "client").map((p, i) => <PBtn key={p.id} p={p} onClick={() => onLogin(p)} d={i} />)}
            {f.length === 0 && <div style={{ textAlign: "center", padding: 30, color: "#7d8590", fontSize: 13 }}>No matches</div>}
          </div>
        </div>
      </Shell>
    );
  }

  if (view === "admin") {
    return (
      <Shell>
        <div style={{ padding: "20px 20px 40px", maxWidth: 400, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 30 }}>
            <button onClick={() => setView("home")} className="btn-s" style={backBtn}>‹</button>
            <div style={{ fontFamily: "'Sora'", fontSize: 18, fontWeight: 700 }}>Admin Login</div>
          </div>
          <div style={{ textAlign: "center", marginBottom: 30 }}><div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div><div style={{ fontSize: 14, color: "#7d8590" }}>Enter your admin PIN</div></div>
          <input type="password" placeholder="• • • •" value={pinVal} autoFocus onChange={e => { setPinVal(e.target.value); setPinErr(false); }} onKeyDown={e => e.key === "Enter" && tryAdmin()}
            style={{ width: "100%", padding: 16, borderRadius: 12, background: "#161b22", border: `2px solid ${pinErr ? "#da3633" : "#21262d"}`, color: "#e6edf3", fontFamily: "'Sora'", fontSize: 24, outline: "none", textAlign: "center", letterSpacing: 10, animation: pinErr ? "shake 0.4s ease" : "none", marginBottom: 12 }} />
          {pinErr && <div style={{ textAlign: "center", color: "#da3633", fontSize: 13, marginBottom: 8 }}>Incorrect PIN</div>}
          <button onClick={tryAdmin} className="btn-s" style={{ ...greenBtn, width: "100%", fontSize: 15 }}>Enter Dashboard</button>
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "#7d8590" }}>Default PIN: 2026</div>
        </div>
      </Shell>
    );
  }

  // HOME — Rules first, then CTA, then leaderboard
  return (
    <Shell>
      <div style={{ padding: "20px 20px 30px", maxWidth: 480, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "'Sora'", fontSize: 28, fontWeight: 800, letterSpacing: "-1px", background: "linear-gradient(135deg, #f0b429, #f7d070)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Daily Reports</div>
          <div style={{ fontSize: 15, color: "#e6edf3", marginTop: 6, fontWeight: 600 }}>{fFull(today)}</div>
          <div style={{ fontSize: 13, color: "#7d8590", marginTop: 2 }}>{time} Kyiv time · {roster.length} members</div>
        </div>

        {/* HOW TO PLAY — ON TOP */}
        <button onClick={() => setRulesOpen(!rulesOpen)} className="btn-s" style={{ width: "100%", padding: "14px 16px", borderRadius: rulesOpen ? "12px 12px 0 0" : 12, border: `1px solid ${rulesOpen ? "#f0b42940" : "#21262d"}`, borderBottom: rulesOpen ? "none" : undefined, background: rulesOpen ? "#f0b42908" : "#161b22", color: rulesOpen ? "#f0b429" : "#e6edf3", fontFamily: "'Sora'", fontSize: 15, fontWeight: 700, cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: rulesOpen ? 0 : 14 }}>
          <span>📖 How to Play</span><span style={{ fontSize: 16, transition: "transform 0.2s", transform: rulesOpen ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
        </button>
        {rulesOpen && (
          <div style={{ background: "#161b22", borderRadius: "0 0 12px 12px", border: "1px solid #f0b42940", borderTop: "none", padding: "16px 14px", marginBottom: 16, animation: "fadeIn 0.25s" }}>
            <div style={{ fontSize: 13, color: "#e6edf3", lineHeight: 1.7 }}>
              <div style={{ fontFamily: "'Sora'", fontWeight: 700, fontSize: 14, color: "#f0b429", marginBottom: 8 }}>🎯 The Goal</div>
              <p style={{ marginBottom: 12, color: "#adbac7" }}>Submit <strong style={{ color: "#e6edf3" }}>4 reports every day</strong>: a Client Report and an Internal Report, each for morning and evening.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
                {[{ l: "📤 Client Morning", dl: "by 11:00 AM" }, { l: "📤 Client Evening", dl: "by 12:00 AM" }, { l: "📋 Internal Morning", dl: "by 11:00 AM" }, { l: "📋 Internal Evening", dl: "by 12:00 AM" }].map(r => (
                  <div key={r.l} style={{ background: "#0d1117", borderRadius: 8, padding: "8px 10px", border: "1px solid #21262d" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#4ecdc4" }}>{r.l}</div>
                    <div style={{ fontSize: 10, color: "#7d8590" }}>{r.dl} Kyiv</div>
                  </div>
                ))}
              </div>

              <div style={{ fontFamily: "'Sora'", fontWeight: 700, fontSize: 14, color: "#4ecdc4", marginBottom: 8 }}>⚡ Points Per Report</div>
              <div style={{ display: "grid", gap: 5, marginBottom: 14 }}>
                {[[10,"EARLY","60+ min before deadline","⚡","#00ffab"],[8,"ON TIME","within 60 min of deadline","✓","#4ecdc4"],[5,"LATE","up to 2 hours after","⏰","#f0b429"],[2,"VERY LATE","2+ hours after","😬","#ff6b6b"],[0,"MISSED","no submission","✗","#4a4a5a"]].map(([p,n,d,i,c]) => (
                  <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#0d1117", borderRadius: 8, border: `1px solid ${c}12` }}>
                    <div style={{ fontFamily: "'Sora'", fontWeight: 800, fontSize: 16, color: c, minWidth: 24, textAlign: "center" }}>{p}</div>
                    <div><div style={{ fontSize: 11, fontWeight: 600, color: c }}>{i} {n}</div><div style={{ fontSize: 10, color: "#7d8590" }}>{d}</div></div>
                  </div>
                ))}
              </div>

              <div style={{ fontFamily: "'Sora'", fontWeight: 700, fontSize: 14, color: "#ff6b35", marginBottom: 8 }}>🔥 Streak Bonus</div>
              <p style={{ marginBottom: 14, color: "#adbac7" }}>Submit <strong style={{ color: "#e6edf3" }}>all 4 reports on time or early</strong> every day. Each consecutive day earns <strong style={{ color: "#ff6b35" }}>+3 bonus points</strong>. Miss one or submit late? Streak resets.</p>

              <div style={{ fontFamily: "'Sora'", fontWeight: 700, fontSize: 14, color: "#00ffab", marginBottom: 8 }}>🏆 Maximum Points</div>
              <div style={{ background: "#0d1117", borderRadius: 10, padding: "12px 14px", border: "1px solid #00ffab20", marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "#adbac7", lineHeight: 1.8 }}>
                  Per day: <strong style={{ color: "#00ffab" }}>4 × 10 = 40 points</strong> (all 4 reports early)<br />
                  With 7-day streak: <strong style={{ color: "#00ffab" }}>40 + 21 = 61 points</strong> in a single day<br />
                  Perfect week: <strong style={{ color: "#00ffab" }}>7 × 40 + 21 = 301 points</strong>
                </div>
              </div>

              <div style={{ fontFamily: "'Sora'", fontWeight: 700, fontSize: 14, color: "#e6edf3", marginBottom: 8 }}>📋 How to Submit</div>
              {["Tap \"Submit My Reports\" below", "Find and tap your name", "Hit the green SUBMIT button for each of your 4 reports", "Done! Points are calculated instantly based on your timestamp"].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: "linear-gradient(135deg, #4ecdc4, #00ffab)", color: "#0d1117", fontFamily: "'Sora'", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: 12, color: "#adbac7", paddingTop: 2 }}>{s}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <button onClick={() => setView("login")} className="btn-s" style={{ ...greenBtn, width: "100%", fontSize: 16, padding: 16, marginBottom: 16 }}>📋 SUBMIT MY REPORTS</button>

        {/* Pulse */}
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {[
            { l: "📤 Client AM", v: countSubs(roster, ts, "client_morning") },
            { l: "📤 Client PM", v: countSubs(roster, ts, "client_evening") },
            { l: "📋 Internal AM", v: countSubs(roster, ts, "internal_morning") },
            { l: "📋 Internal PM", v: countSubs(roster, ts, "internal_evening") },
          ].map((s, i) => (
            <div key={i} style={{ flex: "1 1 45%", background: "#161b22", borderRadius: 10, padding: "9px 8px", border: "1px solid #21262d", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#7d8590", marginBottom: 2 }}>{s.l}</div>
              <div style={{ fontFamily: "'Sora'", fontSize: 18, fontWeight: 800, color: s.v === roster.length ? "#00ffab" : s.v > 0 ? "#f0b429" : "#4a4a5a" }}>{s.v}<span style={{ fontSize: 11, color: "#7d8590", fontWeight: 500 }}>/{roster.length}</span></div>
            </div>
          ))}
        </div>

        {/* FULL LEADERBOARD */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: "'Sora'", fontSize: 16, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>🏆 Leaderboard</div>
          {lb.length >= 3 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "flex-end" }}>
              {[1, 0, 2].map(idx => {
                const p = lb[idx]; const isF = idx === 0; const rk = RK[idx];
                return (
                  <div key={p.id} style={{ flex: 1, textAlign: "center", animation: "slideUp 0.4s ease forwards", animationDelay: `${idx * 80}ms`, animationFillMode: "both" }}>
                    <div style={{ background: "#161b22", borderRadius: 14, padding: isF ? "16px 4px 10px" : "10px 4px 8px", border: `1px solid ${rk.b}30`, ...(isF ? { boxShadow: `0 0 20px ${rk.b}15` } : {}) }}>
                      <div style={{ fontSize: isF ? 24 : 18 }}>{rk.badge}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: rk.b, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "0 2px" }}>{p.name}</div>
                      <div style={{ fontFamily: "'Sora'", fontSize: isF ? 22 : 16, fontWeight: 800, color: rk.b, marginTop: 2 }}>{p.points}</div>
                      <div style={{ fontSize: 8, color: "#7d8590" }}>PTS</div>
                      {p.stk > 0 && <div style={{ fontSize: 9, color: "#ff6b35" }}>🔥 {p.stk}d</div>}
                      <div style={{ fontSize: 9, color: "#7d8590", marginTop: 2 }}>{p.done}/4 today</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {lb.slice(3).map((p, i) => (
            <div key={p.id} className="row-enter" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#161b22", borderRadius: 10, marginBottom: 3, border: "1px solid #21262d", animationDelay: `${i * 20}ms`, animationFillMode: "both" }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Sora'", fontSize: 10, fontWeight: 700, background: "#21262d", color: "#7d8590", flexShrink: 0 }}>{i + 4}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}{p.type === "team" && <span style={{ fontSize: 8, background: "#f0b42920", color: "#f0b429", padding: "1px 4px", borderRadius: 3, marginLeft: 4, fontWeight: 700 }}>TEAM</span>}</div></div>
              <div style={{ fontSize: 9, color: p.done === 4 ? "#00ffab" : p.done > 0 ? "#f0b429" : "#4a4a5a", flexShrink: 0 }}>{p.done}/4</div>
              {p.stk > 0 && <span style={{ fontSize: 9, color: "#ff6b35", flexShrink: 0 }}>🔥{p.stk}</span>}
              <div style={{ fontFamily: "'Sora'", fontSize: 14, fontWeight: 800, color: "#e6edf3", minWidth: 30, textAlign: "right" }}>{p.points}</div>
            </div>
          ))}
        </div>

        <button onClick={() => setView("admin")} className="btn-s" style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #21262d", background: "transparent", color: "#7d8590", fontFamily: "'DM Sans'", fontSize: 13, cursor: "pointer" }}>🔐 Admin Dashboard</button>
      </div>
    </Shell>
  );
}

function PBtn({ p, onClick, d }) {
  return (
    <button className="row-enter" onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 10, marginBottom: 4, background: "#161b22", border: "1px solid #21262d", color: "#e6edf3", fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 500, cursor: "pointer", transition: "all 0.15s", textAlign: "left", animationDelay: `${d * 18}ms`, animationFillMode: "both" }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: p.type === "team" ? "linear-gradient(135deg,#f0b42930,#f0b42910)" : "linear-gradient(135deg,#4ecdc420,#4ecdc410)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0, color: p.type === "team" ? "#f0b429" : "#4ecdc4" }}>{p.name.charAt(0).toUpperCase()}</div>
      <div style={{ flex: 1 }}>{p.name}</div>
      {p.type === "team" && <span style={{ fontSize: 9, background: "#f0b42920", color: "#f0b429", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>TEAM</span>}
      <span style={{ color: "#7d8590", fontSize: 16 }}>›</span>
    </button>
  );
}

/* ============================================================ */
/*  USER DASHBOARD                                               */
/* ============================================================ */
function UserD({ user, roster, subs, svS, onOut, time }) {
  const [toast, setToast] = useState(null); const [flash, setFlash] = useState(null);
  const [tab, setTab] = useState("submit"); const [lbP, setLbP] = useState("all");
  const tr = useRef(null);
  const sT = msg => { setToast(msg); if (tr.current) clearTimeout(tr.current); tr.current = setTimeout(() => setToast(null), 2500); };

  const today = ukDate(); const my = subs[today]?.[user.id] || {};
  const stk = gStreak(user.id, subs, today); const tp = gTotal(user.id, subs, today);
  const doneCount = RKEYS.filter(k => my[k]).length;

  const doSub = rkey => {
    const now = new Date().toISOString();
    const next = { ...subs }; if (!next[today]) next[today] = {}; if (!next[today][user.id]) next[today][user.id] = {};
    next[today][user.id] = { ...next[today][user.id], [rkey]: now };
    svS(next); setFlash(rkey); setTimeout(() => setFlash(null), 2000);
    const pts = cP(now, rkey); const l = pL(pts);
    sT(`${l.i} ${RLABELS[rkey]} — ${pts} pts (${l.t})`);
  };

  const lb = roster.map(p => ({ ...p, points: gTotal(p.id, subs, today) })).sort((a, b) => b.points - a.points);
  const myRank = lb.findIndex(p => p.id === user.id) + 1;

  return (
    <Shell>
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div><div style={{ fontSize: 13, color: "#7d8590" }}>Welcome back,</div><div style={{ fontFamily: "'Sora'", fontSize: 22, fontWeight: 800, marginTop: 2 }}>{user.name}</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}><div style={{ fontFamily: "'Sora'", fontSize: 18, fontWeight: 700, background: "linear-gradient(135deg, #4ecdc4, #00ffab)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{time}</div><div style={{ fontSize: 10, color: "#7d8590" }}>Kyiv</div></div>
            <button onClick={onOut} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #21262d", background: "transparent", color: "#7d8590", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans'" }}>Log out</button>
          </div>
        </div>
        <div style={{ background: "#161b22", borderRadius: 10, padding: "9px 14px", border: "1px solid #21262d", marginBottom: 12, textAlign: "center" }}><div style={{ fontSize: 14, fontWeight: 600 }}>{fFull(today)}</div></div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {[{ l: "Rank", v: `#${myRank}`, c: myRank <= 3 ? "#f0b429" : "#4ecdc4" }, { l: "Points", v: tp, c: "#00ffab" }, { l: "Streak", v: stk > 0 ? `🔥 ${stk}d` : "—", c: "#ff6b35" }, { l: "Today", v: `${doneCount}/4`, c: doneCount === 4 ? "#00ffab" : "#f0b429" }].map((s, i) => (
            <div key={i} style={{ flex: 1, background: "#161b22", borderRadius: 10, padding: "8px 6px", border: "1px solid #21262d", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#7d8590", marginBottom: 2, textTransform: "uppercase" }}>{s.l}</div>
              <div style={{ fontFamily: "'Sora'", fontSize: 16, fontWeight: 800, color: s.c }}>{s.v}</div>
            </div>
          ))}
        </div>
        <TB tabs={[{ k: "submit", l: "Submit", i: "📋" }, { k: "lb", l: "Ranks", i: "🏆" }]} a={tab} o={setTab} />
      </div>
      <div style={{ padding: "14px 20px 40px" }}>
        {tab === "submit" && (
          <div style={{ animation: "fadeIn 0.3s" }}>
            <SL text="Morning Reports — Deadline 11:00 AM" c="#f0b429" />
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {["client_morning", "internal_morning"].map(k => <SCMini key={k} rkey={k} done={!!my[k]} dT={my[k]} onS={() => doSub(k)} fl={flash === k} pts={my[k] ? cP(my[k], k) : null} />)}
            </div>
            <SL text="Evening Reports — Deadline 12:00 AM" c="#4ecdc4" />
            <div style={{ display: "flex", gap: 8 }}>
              {["client_evening", "internal_evening"].map(k => <SCMini key={k} rkey={k} done={!!my[k]} dT={my[k]} onS={() => doSub(k)} fl={flash === k} pts={my[k] ? cP(my[k], k) : null} />)}
            </div>
          </div>
        )}
        {tab === "lb" && (
          <div style={{ animation: "fadeIn 0.3s" }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "#161b22", borderRadius: 8, padding: 3, border: "1px solid #21262d" }}>
              {[{ k: "all", l: "All Time" }, { k: "week", l: "This Week" }].map(x => (
                <button key={x.k} onClick={() => setLbP(x.k)} style={{ flex: 1, padding: 8, borderRadius: 6, border: "none", background: lbP === x.k ? "#0d1117" : "transparent", color: lbP === x.k ? "#e6edf3" : "#7d8590", fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{x.l}</button>
              ))}
            </div>
            <LBFull roster={roster} subs={subs} today={today} myId={user.id} period={lbP} />
          </div>
        )}
      </div>
      {toast && <Toast msg={toast} />}
    </Shell>
  );
}

function SCMini({ rkey, done, dT, onS, fl, pts }) {
  const isClient = rkey.includes("client"); const pl = pts !== null ? pL(pts) : null;
  return (
    <div style={{ flex: 1, padding: 14, borderRadius: 12, border: `1px solid ${done ? "#4ecdc430" : "#21262d"}`, background: done ? "linear-gradient(135deg, rgba(78,205,196,0.06), rgba(0,255,171,0.03))" : "#161b22", transition: "all 0.3s", animation: fl ? "celebrateCard 0.5s ease" : "none" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>{isClient ? "📤" : "📋"} {isClient ? "Client" : "Internal"}</div>
      {done ? (
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, marginBottom: 2 }}>✅</div><div style={{ fontSize: 11, fontWeight: 600, color: pl?.c }}>{pl?.i} {pts}pt</div><div style={{ fontSize: 10, color: "#7d8590" }}>{fT(dT)}</div></div>
      ) : (
        <button onClick={onS} className="btn-s" style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: "linear-gradient(135deg, #4ecdc4, #00ffab)", color: "#0d1117", fontFamily: "'Sora'", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 12px rgba(78,205,196,0.25)" }}>SUBMIT</button>
      )}
    </div>
  );
}

function LBFull({ roster, subs, today, myId, period }) {
  const lb = roster.map(p => ({
    ...p, points: period === "week" ? gWeek(p.id, subs) : gTotal(p.id, subs, today),
    stk: gStreak(p.id, subs, today), done: RKEYS.filter(k => subs[today]?.[p.id]?.[k]).length,
  })).sort((a, b) => b.points - a.points);
  return lb.map((p, i) => {
    const me = myId && p.id === myId; const rs = i < 3 ? RK[i] : null;
    return (
      <div key={p.id} className="row-enter" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", background: me ? "#4ecdc408" : "#161b22", borderRadius: 10, marginBottom: 3, border: `1px solid ${me ? "#4ecdc430" : rs ? rs.b + "25" : "#21262d"}`, animationDelay: `${i * 20}ms`, animationFillMode: "both", ...(i === 0 ? { animation: "glow 3s ease infinite, slideUp 0.3s ease forwards" } : {}) }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Sora'", fontSize: rs ? 12 : 10, fontWeight: 700, background: rs ? rs.bg : "#21262d", color: rs ? rs.t : "#7d8590", flexShrink: 0 }}>{rs ? rs.badge : i + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: me ? "#4ecdc4" : i === 0 ? "#f0b429" : "#e6edf3" }}>{p.name} {me && <span style={{ fontSize: 9, opacity: 0.5 }}>(you)</span>}{p.type === "team" && <span style={{ fontSize: 8, background: "#f0b42920", color: "#f0b429", padding: "1px 4px", borderRadius: 3, marginLeft: 4, fontWeight: 700 }}>TEAM</span>}</div>
          <div style={{ fontSize: 9, color: "#7d8590" }}>{p.stk > 0 && <span style={{ color: "#ff6b35" }}>🔥 {p.stk}d · </span>}{p.done}/4 today</div>
        </div>
        <div style={{ fontFamily: "'Sora'", fontSize: 15, fontWeight: 800, color: i === 0 ? "#f0b429" : i === 1 ? "#a0aec0" : i === 2 ? "#c4956a" : "#e6edf3" }}>{p.points}<span style={{ fontSize: 8, color: "#7d8590", fontWeight: 500 }}> PTS</span></div>
      </div>
    );
  });
}

/* ============================================================ */
/*  ADMIN                                                        */
/* ============================================================ */
function Admin({ roster, subs, setRoster, setSubs, pin, svP, onOut, time }) {
  const [tab, setTab] = useState("today"); const [sf, setSf] = useState(""); const [lbP, setLbP] = useState("all");
  const [nn, setNn] = useState(""); const [nt, setNt] = useState("client");
  const [toast, setToast] = useState(null); const [hd, setHd] = useState(ukDate());
  const [showSet, setShowSet] = useState(false); const [newPin, setNewPin] = useState(""); const [showPin, setShowPin] = useState(false);
  const tr = useRef(null);
  const sT = msg => { setToast(msg); if (tr.current) clearTimeout(tr.current); tr.current = setTimeout(() => setToast(null), 2500); };

  const today = ukDate(); const ts = subs[today] || {};
  const mp = ukNow().getHours() * 60 + ukNow().getMinutes() >= 660;

  const mark = (pid, rkey) => {
    const now = new Date().toISOString();
    const next = { ...subs }; if (!next[today]) next[today] = {}; if (!next[today][pid]) next[today][pid] = {};
    if (next[today][pid][rkey]) { delete next[today][pid][rkey]; setSubs(next); return; }
    next[today][pid] = { ...next[today][pid], [rkey]: now };
    setSubs(next); sT(`${roster.find(r => r.id === pid)?.name} — ${RLABELS[rkey]} logged`);
  };

  const addP = () => { if (!nn.trim()) return; setRoster([...roster, { id: "c" + Date.now(), name: nn.trim(), type: nt }]); sT(`${nn.trim()} added`); setNn(""); };
  const remP = id => { sT(`${roster.find(r => r.id === id)?.name} removed`); setRoster(roster.filter(r => r.id !== id)); };
  const reset = () => { if (!confirm("Reset all data?")) return; setSubs({}); sT("Data reset"); };
  const chgPin = () => { if (newPin.length < 3) return; svP(newPin); setNewPin(""); sT("PIN updated: " + newPin); };

  const flt = sf ? roster.filter(r => r.name.toLowerCase().includes(sf.toLowerCase())) : roster;
  const hs = subs[hd] || {};
  const isToday = hd === today;

  return (
    <Shell>
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div><div style={{ fontFamily: "'Sora'", fontSize: 20, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>Admin <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "linear-gradient(135deg,#4ecdc4,#00ffab)", color: "#0d1117", fontWeight: 700 }}>DASHBOARD</span></div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setShowSet(!showSet)} style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #21262d", background: showSet ? "#21262d" : "transparent", color: "#7d8590", fontSize: 14, cursor: "pointer" }}>⚙️</button>
            <button onClick={onOut} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #21262d", background: "transparent", color: "#7d8590", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans'" }}>Log out</button>
          </div>
        </div>
        {showSet && (
          <div style={{ background: "#161b22", borderRadius: 10, padding: 14, border: "1px solid #21262d", marginTop: 8, marginBottom: 6, animation: "fadeIn 0.2s" }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>⚙️ Admin PIN</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "#7d8590" }}>Current:</span>
              <span style={{ fontFamily: "'Sora'", fontSize: 16, fontWeight: 700, letterSpacing: 3 }}>{showPin ? pin : "••••"}</span>
              <button onClick={() => setShowPin(!showPin)} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #21262d", background: "transparent", color: "#7d8590", fontSize: 10, cursor: "pointer" }}>{showPin ? "Hide" : "Show"}</button>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" placeholder="New PIN..." value={newPin} onChange={e => setNewPin(e.target.value)} onKeyDown={e => e.key === "Enter" && chgPin()} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, background: "#0d1117", border: "1px solid #21262d", color: "#e6edf3", fontFamily: "'DM Sans'", fontSize: 13, outline: "none", letterSpacing: 3 }} />
              <button onClick={chgPin} className="btn-s" style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: "linear-gradient(135deg, #4ecdc4, #00ffab)", color: "#0d1117", fontFamily: "'Sora'", fontSize: 11, fontWeight: 700 }}>Update</button>
            </div>
          </div>
        )}
        <div style={{ background: "#161b22", borderRadius: 10, padding: "8px 14px", border: "1px solid #21262d", marginTop: 6, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Sora'" }}>{fFull(today)}</div>
          <div style={{ fontFamily: "'Sora'", fontSize: 16, fontWeight: 700, background: "linear-gradient(135deg, #4ecdc4, #00ffab)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{time}</div>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {RKEYS.map(k => {
            const c = countSubs(roster, ts, k);
            return <div key={k} style={{ flex: "1 1 45%", background: "#161b22", borderRadius: 8, padding: "7px 8px", border: "1px solid #21262d", textAlign: "center" }}><div style={{ fontSize: 8, color: "#7d8590", marginBottom: 1 }}>{RLABELS[k]}</div><div style={{ fontFamily: "'Sora'", fontSize: 14, fontWeight: 700, color: c === roster.length ? "#00ffab" : c > 0 ? "#f0b429" : "#4a4a5a" }}>{c}/{roster.length}</div></div>;
          })}
        </div>
        <TB tabs={[{ k: "today", l: "Today", i: "📋" }, { k: "reports", l: "Reports", i: "📊" }, { k: "history", l: "History", i: "📅" }, { k: "lb", l: "Ranks", i: "🏆" }, { k: "roster", l: "Roster", i: "👥" }]} a={tab} o={setTab} sm />
      </div>
      <div style={{ padding: "10px 20px 40px" }}>
        {tab === "today" && (
          <div style={{ animation: "fadeIn 0.3s" }}>
            <input type="text" placeholder="Search..." value={sf} onChange={e => setSf(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />
            {flt.filter(r => r.type === "team").length > 0 && (<><SL text="Team" c="#f0b429" />{flt.filter(r => r.type === "team").map((p, i) => <AR key={p.id} p={p} s={ts[p.id] || {}} m={mark} d={i} mp={mp} />)}<div style={{ height: 6 }} /></>)}
            <SL text={`Clients (${flt.filter(r => r.type === "client").length})`} c="#4ecdc4" />
            {flt.filter(r => r.type === "client").map((p, i) => <AR key={p.id} p={p} s={ts[p.id] || {}} m={mark} d={i} mp={mp} />)}
          </div>
        )}
        {tab === "reports" && (
          <div style={{ animation: "fadeIn 0.3s" }}>
            <DT roster={roster} ds={ts} />
            <div style={{ marginTop: 10 }}>
              {RKEYS.map(k => { const miss = roster.filter(r => !ts[r.id]?.[k]).map(r => r.name); return <div key={k} style={{ background: "#161b22", borderRadius: 8, padding: 8, border: "1px solid #21262d", marginBottom: 4 }}><div style={{ fontSize: 10, color: "#7d8590", marginBottom: 3 }}>Missing {RLABELS[k]}</div><div style={{ fontSize: 11, color: miss.length > 0 ? "#ff6b6b" : "#00ffab" }}>{miss.length > 0 ? miss.join(", ") : "All done ✅"}</div></div>; })}
            </div>
          </div>
        )}
        {tab === "history" && (
          <div style={{ animation: "fadeIn 0.3s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <button onClick={() => setHd(shD(hd, -1))} className="btn-s" style={backBtn}>‹</button>
              <div style={{ flex: 1, textAlign: "center" }}><div style={{ fontFamily: "'Sora'", fontSize: 14, fontWeight: 700, color: isToday ? "#4ecdc4" : "#e6edf3" }}>{isToday ? "Today" : fShort(hd)}</div><div style={{ fontSize: 11, color: "#7d8590" }}>{hd}</div></div>
              <button onClick={() => hd < today && setHd(shD(hd, 1))} className="btn-s" style={{ ...backBtn, color: hd >= today ? "#7d859040" : "#e6edf3" }}>›</button>
              <button onClick={() => setHd(today)} className="btn-s" style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${isToday ? "#4ecdc440" : "#21262d"}`, background: isToday ? "#4ecdc415" : "#161b22", color: isToday ? "#4ecdc4" : "#7d8590", fontSize: 11, fontWeight: 600 }}>Today</button>
            </div>
            {hd > today ? <div style={{ textAlign: "center", padding: 30, color: "#7d8590" }}>Future</div> : <DT roster={roster} ds={hs} />}
            {Object.keys(subs).length > 0 && (
              <div style={{ marginTop: 12 }}><SL text="Dates with data" c="#7d8590" /><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {Object.keys(subs).sort().reverse().slice(0, 14).map(d => <button key={d} onClick={() => setHd(d)} className="btn-s" style={{ padding: "4px 8px", borderRadius: 6, fontSize: 10, border: `1px solid ${d === hd ? "#4ecdc440" : "#21262d"}`, background: d === hd ? "#4ecdc415" : "#161b22", color: d === hd ? "#4ecdc4" : "#e6edf3", fontFamily: "'DM Sans'" }}>{d === today ? "Today" : fShort(d)}</button>)}
              </div></div>
            )}
          </div>
        )}
        {tab === "lb" && (
          <div style={{ animation: "fadeIn 0.3s" }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 10, background: "#161b22", borderRadius: 8, padding: 3, border: "1px solid #21262d" }}>
              {[{ k: "all", l: "All Time" }, { k: "week", l: "This Week" }].map(x => <button key={x.k} onClick={() => setLbP(x.k)} style={{ flex: 1, padding: 7, borderRadius: 6, border: "none", background: lbP === x.k ? "#0d1117" : "transparent", color: lbP === x.k ? "#e6edf3" : "#7d8590", fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>{x.l}</button>)}
            </div>
            <LBFull roster={roster} subs={subs} today={today} period={lbP} />
            {Object.keys(subs).length > 0 && <button onClick={reset} style={{ marginTop: 14, width: "100%", padding: 10, borderRadius: 8, background: "transparent", border: "1px solid #da363330", color: "#da3633", fontFamily: "'DM Sans'", fontSize: 12, cursor: "pointer" }}>Reset All Data</button>}
          </div>
        )}
        {tab === "roster" && (
          <div style={{ animation: "fadeIn 0.3s" }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, padding: 10, background: "#161b22", borderRadius: 10, border: "1px solid #21262d" }}>
              <input type="text" placeholder="Name..." value={nn} onChange={e => setNn(e.target.value)} onKeyDown={e => e.key === "Enter" && addP()} style={{ flex: 1, padding: "8px 12px", borderRadius: 6, background: "#0d1117", border: "1px solid #21262d", color: "#e6edf3", fontFamily: "'DM Sans'", fontSize: 13, outline: "none", minWidth: 0 }} />
              <select value={nt} onChange={e => setNt(e.target.value)} style={{ padding: 8, borderRadius: 6, background: "#0d1117", border: "1px solid #21262d", color: "#7d8590", fontFamily: "'DM Sans'", fontSize: 12, outline: "none" }}><option value="client">Client</option><option value="team">Team</option></select>
              <button onClick={addP} className="btn-s" style={{ padding: "8px 14px", borderRadius: 6, border: "none", background: "linear-gradient(135deg, #4ecdc4, #00ffab)", color: "#0d1117", fontFamily: "'Sora'", fontSize: 12, fontWeight: 700 }}>Add</button>
            </div>
            {roster.filter(r => r.type === "team").length > 0 && (<><SL text={`Team (${roster.filter(r => r.type === "team").length})`} c="#f0b429" />{roster.filter(r => r.type === "team").map((p, i) => <RR key={p.id} p={p} rem={remP} d={i} />)}<div style={{ height: 6 }} /></>)}
            <SL text={`Clients (${roster.filter(r => r.type === "client").length})`} c="#4ecdc4" />
            {roster.filter(r => r.type === "client").map((p, i) => <RR key={p.id} p={p} rem={remP} d={i} />)}
          </div>
        )}
      </div>
      {toast && <Toast msg={toast} />}
    </Shell>
  );
}

function DT({ roster, ds }) {
  return (
    <div style={{ background: "#161b22", borderRadius: 10, border: "1px solid #21262d", overflow: "hidden" }}>
      <div style={{ display: "flex", padding: "7px 10px", borderBottom: "1px solid #21262d", fontSize: 9, fontWeight: 600, color: "#7d8590", textTransform: "uppercase" }}>
        <div style={{ flex: 1 }}>Name</div><div style={{ width: 52, textAlign: "center" }}>📤AM</div><div style={{ width: 52, textAlign: "center" }}>📤PM</div><div style={{ width: 52, textAlign: "center" }}>📋AM</div><div style={{ width: 52, textAlign: "center" }}>📋PM</div><div style={{ width: 30, textAlign: "center" }}>Pts</div>
      </div>
      {roster.map((p, i) => {
        const s = ds[p.id] || {};
        const dayP = RKEYS.reduce((t, k) => t + (s[k] ? cP(s[k], k) : 0), 0);
        return (
          <div key={p.id} style={{ display: "flex", alignItems: "center", padding: "6px 10px", borderBottom: i < roster.length - 1 ? "1px solid #21262d10" : "none", background: i % 2 === 1 ? "#161b2280" : "transparent" }}>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div></div>
            {RKEYS.map(k => { const v = s[k]; const pts = v ? cP(v, k) : 0; const l = pL(pts); return <div key={k} style={{ width: 52, textAlign: "center" }}>{v ? (<><div style={{ fontSize: 10, fontWeight: 600, color: l.c }}>{fT(v)}</div><div style={{ fontSize: 7, color: l.c, fontWeight: 700 }}>{pts}pt</div></>) : (<div style={{ fontSize: 9, color: "#4a4a5a" }}>✗</div>)}</div>; })}
            <div style={{ width: 30, textAlign: "center", fontFamily: "'Sora'", fontSize: 11, fontWeight: 700, color: dayP >= 32 ? "#00ffab" : dayP > 0 ? "#f0b429" : "#4a4a5a" }}>{dayP}</div>
          </div>
        );
      })}
    </div>
  );
}

function AR({ p, s, m, d, mp }) {
  const done = RKEYS.filter(k => s[k]).length;
  return (
    <div className="row-enter" style={{ background: "#161b22", borderRadius: 10, marginBottom: 4, border: "1px solid #21262d", animationDelay: `${d * 14}ms`, animationFillMode: "both", padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
        <div style={{ fontSize: 10, color: done === 4 ? "#00ffab" : done > 0 ? "#f0b429" : "#7d8590" }}>{done}/4</div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {RKEYS.map(k => {
          const v = s[k]; const pts = v ? cP(v, k) : null; const l = pts !== null ? pL(pts) : null;
          const isM = RTIME(k) === "morning"; const isC = k.includes("client");
          return <button key={k} className="btn-s" onClick={() => m(p.id, k)} style={{ flex: 1, padding: "4px 2px", borderRadius: 6, fontSize: 9, fontWeight: 600, border: `1px solid ${v ? l?.c + "40" : "transparent"}`, background: v ? `${l?.c}15` : isM && mp ? "#da363308" : "#21262d", color: v ? l?.c : isM && mp ? "#da3633" : "#7d8590", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}>
            <span style={{ fontSize: 10 }}>{isC ? "📤" : "📋"}{isM ? "☀" : "☽"}</span><span>{v ? l?.t : isM && mp ? "DUE" : "—"}</span>
          </button>;
        })}
      </div>
    </div>
  );
}

function RR({ p, rem, d }) {
  return <div className="row-enter" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#161b22", borderRadius: 10, marginBottom: 4, border: "1px solid #21262d", animationDelay: `${d * 14}ms`, animationFillMode: "both" }}>
    <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.type === "team" ? "#f0b429" : "#4ecdc4", flexShrink: 0 }} />
    <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{p.name}</div>
    <button className="btn-s" onClick={() => rem(p.id)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #da363330", background: "transparent", color: "#da3633", fontSize: 11, fontFamily: "'DM Sans'", cursor: "pointer" }}>Remove</button>
  </div>;
}

function TB({ tabs, a, o, sm }) {
  return <div style={{ display: "flex", background: "#161b22", borderRadius: 10, padding: 3, border: "1px solid #21262d" }}>
    {tabs.map(t => <button key={t.k} onClick={() => o(t.k)} style={{ flex: 1, padding: sm ? "7px 2px" : "10px 12px", borderRadius: 8, border: "none", background: a === t.k ? "#0d1117" : "transparent", color: a === t.k ? "#e6edf3" : "#7d8590", fontFamily: "'DM Sans'", fontSize: sm ? 10 : 13, fontWeight: a === t.k ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap" }}>{t.i} {t.l}</button>)}
  </div>;
}

function SL({ text, c }) { return <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: c, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 2, background: c, borderRadius: 1 }} />{text}</div>; }
function Toast({ msg }) { return <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg, #161b22, #1c2128)", border: "1px solid #4ecdc440", color: "#e6edf3", fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 500, boxShadow: "0 8px 30px rgba(0,0,0,0.4)", animation: "toastIn 0.3s ease", zIndex: 100, whiteSpace: "nowrap" }}>{msg}</div>; }

const backBtn = { width: 36, height: 36, borderRadius: 8, border: "1px solid #21262d", background: "#161b22", color: "#e6edf3", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" };
const greenBtn = { padding: 14, borderRadius: 12, border: "none", background: "linear-gradient(135deg, #4ecdc4, #00ffab)", color: "#0d1117", fontFamily: "'Sora'", fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 24px rgba(78,205,196,0.35)", letterSpacing: "0.5px" };
const inputStyle = { width: "100%", padding: "12px 16px", borderRadius: 10, background: "#161b22", border: "1px solid #21262d", color: "#e6edf3", fontFamily: "'DM Sans'", fontSize: 14, outline: "none", marginBottom: 12 };

function Shell({ children }) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}body{background:#0d1117}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#2d333b;border-radius:3px}
        @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes toastIn{from{opacity:0;transform:translateY(20px)scale(0.95)}to{opacity:1;transform:translateY(0)scale(1)}}
        @keyframes glow{0%,100%{box-shadow:0 0 8px rgba(0,255,171,0.3)}50%{box-shadow:0 0 20px rgba(0,255,171,0.5)}}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
        @keyframes celebrateCard{0%{transform:scale(1)}30%{transform:scale(1.02)}100%{transform:scale(1)}}
        .row-enter{animation:slideUp 0.3s ease forwards}
        .btn-s{transition:all 0.15s ease;cursor:pointer}
        .btn-s:hover{transform:scale(1.03)}
        .btn-s:active{transform:scale(0.97)}
      `}</style>
      <div style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3", fontFamily: "'DM Sans',sans-serif", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 200, background: "linear-gradient(180deg, rgba(78,205,196,0.08) 0%, transparent 100%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      </div>
    </>
  );
}
