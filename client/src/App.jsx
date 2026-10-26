import { useState, useEffect, Fragment } from "react";

const api = async (path, method = "GET", body) => {
  const t = localStorage.getItem("cx_token");
  let r;
  try {
    r = await fetch("/api" + path, {
      method,
      headers: { "Content-Type": "application/json", ...(t && { Authorization: "Bearer " + t }) },
      body: body && JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach server — make sure the backend is running.");
  }
  const text = await r.text();
  let d = {};
  try { d = text ? JSON.parse(text) : {}; } catch { /* non-JSON body */ }
  if (!r.ok) throw new Error(d.error || `Server error ${r.status}`);
  return d;
};

const Shield = () => (
  <svg width="34" height="34" viewBox="0 0 34 34" fill="none" className="shield-icon">
    <path d="M17 3L5 8v9c0 7.18 5.14 13.9 12 15.5C23.86 30.9 29 24.18 29 17V8L17 3z" fill="#fff" fillOpacity="0.2" stroke="#fff" strokeWidth="1.5"/>
    <path d="M12 17l3.5 3.5 6.5-7" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ShieldBlue = () => (
  <svg width="34" height="34" viewBox="0 0 34 34" fill="none" className="shield-icon">
    <path d="M17 3L5 8v9c0 7.18 5.14 13.9 12 15.5C23.86 30.9 29 24.18 29 17V8L17 3z" fill="#0a3d91" fillOpacity="0.12" stroke="#0a3d91" strokeWidth="1.5"/>
    <path d="M12 17l3.5 3.5 6.5-7" stroke="#0a3d91" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const UBadge = ({ v }) => {
  if (!v) return null;
  const cls = { Critical: "ub-c", High: "ub-h", Medium: "ub-m", Low: "ub-l" }[v] || "ub-l";
  return <span className={`ubadge ${cls}`}>{v}</span>;
};

const SBadge = ({ v }) => {
  if (!v) return null;
  const cls = { Submitted: "sb-s", Assigned: "sb-a", "In Progress": "sb-p", Resolved: "sb-r" }[v] || "sb-s";
  return <span className={`sbadge ${cls}`}>{v}</span>;
};

const KV = ({ k, v }) => v ? (
  <div className="kv">
    <span className="kv-k">{k}</span>
    <span className="kv-v">{v}</span>
  </div>
) : null;

function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ institution: "", name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });

  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr("");
    try { onAuth(await api(`/auth/${mode}`, "POST", f)); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };

  return (
    <div className="auth-hero">
      <div className="hero-word">COMPLAINX</div>
      <img
        className="campus-img"
        src="/campus.png"
        alt="Campus"
        onError={e => { e.target.style.display = "none"; }}
      />
      <div className="hero-bottom-overlay" />

      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand-row">
          <ShieldBlue />
          <div className="auth-brand-text">
            ComplainX
            <div style={{ fontSize: 11, fontWeight: 400, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>Complaint Portal</div>
          </div>
        </div>
        <h1 className="auth-title">{mode === "login" ? "Welcome back" : "Get started"}</h1>
        <p className="auth-sub">{mode === "login" ? "Sign in to your institution account" : "Create your institution account"}</p>
        <label className="fl">INSTITUTION</label>
        <input placeholder="College, company or municipality name" value={f.institution} onChange={set("institution")} required />
        {mode === "register" && <>
          <label className="fl">FULL NAME</label>
          <input placeholder="Your name" value={f.name} onChange={set("name")} required />
        </>}
        <label className="fl">EMAIL</label>
        <input type="email" placeholder="you@example.com" value={f.email} onChange={set("email")} required />
        <label className="fl">PASSWORD</label>
        <input type="password" placeholder="Min. 6 characters" value={f.password} onChange={set("password")} required />
        {err && <p className="err">{err}</p>}
        <button className="btn-primary" style={{ fontSize: "1.1rem", padding: "0.75rem 1.5rem" }} disabled={busy}>{busy ? "…" : mode === "login" ? "Sign in →" : "Create account →"}</button>
        <button type="button" className="btn-ghost" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}

const STEPS = ["Location", "Details", "Contact"];

function Stepper({ step, onBack }) {
  return (
    <div className="stepper">
      {STEPS.map((label, i) => (
        <Fragment key={i}>
          <div className="step-item" style={{ cursor: i < step ? "pointer" : "default" }} onClick={() => i < step && onBack(i)}>
            <div className={`sdot ${i < step ? "sdone" : i === step ? "sactive" : "spend"}`}>
              {i < step ? "✓" : i + 1}
            </div>
            <span className="slabel">{label}</span>
          </div>
          {i < STEPS.length - 1 && <div className={`sline ${i < step ? "sline-done" : ""}`} />}
        </Fragment>
      ))}
    </div>
  );
}

function ComplaintFlow({ user, onDone }) {
  const [step, setStep] = useState(0);
  const [loc, setLoc] = useState({ building: "", room: "", floor: "" });
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [contact, setContact] = useState({ name: user.name, email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const locStr = [loc.building, loc.room, loc.floor].filter(Boolean).join(", ");
  const nlpText = locStr ? `${locStr}: ${text}` : text;
  const clearErr = () => setErr("");
  const back = i => { setStep(i); clearErr(); };

  const next = () => {
    if (step === 0 && !loc.building.trim()) { setErr("Building / area is required"); return; }
    if (step === 1 && !analysis) { setErr("Please analyze the complaint first"); return; }
    clearErr(); setStep(s => s + 1);
  };

  const analyze = async () => {
    if (!text.trim()) { setErr("Write your complaint first"); return; }
    setBusy(true); clearErr();
    try { setAnalysis(await api("/complaints/analyze", "POST", { text: nlpText })); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };

  const upvote = async () => {
    setBusy(true);
    try { await api(`/complaints/${analysis.duplicates[0].id}/upvote`, "POST"); onDone(null); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };

  const submit = async () => {
    setBusy(true); clearErr();
    try {
      const c = await api("/complaints", "POST", {
        building: loc.building, room: loc.room, floor: loc.floor,
        text, nlpText,
        contactName: contact.name, contactEmail: contact.email, contactPhone: contact.phone,
      });
      onDone(c);
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  return (
    <div className="form-section" id="complaint-form">
      <div className="form-card">
        <div className="flow-header">
          <h2>Submit a Complaint</h2>
          <p>Fill each section — we handle analysis, routing and prioritisation.</p>
        </div>
        <Stepper step={step} onBack={back} />

        {step === 0 && (
          <div className="fields">
            <label className="fl">BUILDING OR AREA *</label>
            <input placeholder="Block A, Library, Hostel C" value={loc.building} onChange={e => setLoc({ ...loc, building: e.target.value })} />
            <div className="field-row">
              <div>
                <label className="fl">ROOM / LAB</label>
                <input placeholder="Lab 4, Room 203" value={loc.room} onChange={e => setLoc({ ...loc, room: e.target.value })} />
              </div>
              <div>
                <label className="fl">FLOOR</label>
                <input placeholder="Ground, 2nd…" value={loc.floor} onChange={e => setLoc({ ...loc, floor: e.target.value })} />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="fields">
            <label className="fl">DESCRIBE THE ISSUE *</label>
            <textarea rows={5} placeholder="The projector in Lab 4 hasn't been working for 3 days and our exam is tomorrow."
              value={text} onChange={e => { setText(e.target.value); setAnalysis(null); }} />
            <button className="btn-secondary" disabled={busy || !text.trim()} onClick={analyze}>
              {busy ? "Analyzing…" : "Analyze →"}
            </button>
            {analysis && (
              <div className="analysis-card">
                <div className="fl" style={{ marginBottom: 10 }}>UNDERSTOOD AS</div>
                <div className="analysis-grid">
                  <KV k="Category" v={analysis.category} />
                  <KV k="Issue" v={analysis.issue} />
                  <div className="kv"><span className="kv-k">Urgency</span><UBadge v={analysis.urgency} /></div>
                  <KV k="Department" v={analysis.department} />
                  <KV k="Deadline" v={analysis.deadline_context} />
                  <KV k="Duration" v={analysis.duration} />
                  <KV k="Sentiment" v={analysis.sentiment} />
                </div>
                {analysis.duplicates?.length > 0 && (
                  <div className="dup-warn">
                    <b>⚠ Similar complaint found — {Math.round(analysis.duplicates[0].similarity * 100)}% match</b>
                    <p className="dup-text">{analysis.duplicates[0].text}</p>
                    <div className="dup-row">
                      <button className="btn-secondary sm" disabled={busy} onClick={upvote}>Upvote existing</button>
                      <button className="btn-ghost sm" disabled={busy} onClick={() => { clearErr(); setStep(2); }}>Submit anyway →</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="fields">
            <label className="fl">YOUR NAME</label>
            <input value={contact.name} onChange={e => setContact({ ...contact, name: e.target.value })} />
            <label className="fl">EMAIL</label>
            <input type="email" placeholder="For status updates" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} />
            <label className="fl">PHONE (OPTIONAL)</label>
            <input placeholder="+91 98765 43210" value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} />
          </div>
        )}

        {err && <p className="err">{err}</p>}

        <div className="step-nav">
          {step > 0 && <button className="btn-ghost" onClick={() => back(step - 1)}>← Back</button>}
          <div style={{ flex: 1 }} />
          {step < 2
            ? <button className="btn-primary" onClick={next} disabled={step === 1 && !analysis}>Next →</button>
            : <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit →"}</button>}
        </div>
      </div>
    </div>
  );
}

function Receipt({ c, onClose, institution }) {
  const loc = [c.building, c.room, c.floor].filter(Boolean).join(", ");
  const brand = institution || c.institution || "ComplainX";
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="receipt" id="receipt-print">
        <div className="receipt-header">
          <div>
            <div className="receipt-brand">{brand}</div>
            <div className="fl">OFFICIAL RECEIPT</div>
          </div>
          {onClose && <button className="btn-ghost sm no-print" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }} onClick={onClose}>✕ Close</button>}
        </div>
        <div className="receipt-body">
          <div className="receipt-id-block">
            <span className="fl">RECEIPT ID</span>
            <span className="receipt-id">{c.receiptId}</span>
          </div>
          <div className="receipt-grid">
            <KV k="Institution" v={c.institution} />
            <KV k="Date & time" v={new Date(c.createdAt).toLocaleString()} />
            <KV k="Location" v={loc || "—"} />
            <KV k="Category" v={c.category} />
            <KV k="Issue" v={c.issue} />
            <KV k="Urgency" v={c.urgency} />
            <KV k="Department" v={c.department} />
            <KV k="Status" v={c.status} />
            <KV k="Contact name" v={c.contactName} />
            <KV k="Contact email" v={c.contactEmail} />
            <KV k="Contact phone" v={c.contactPhone} />
          </div>
          {c.text && (
            <div className="receipt-complaint">
              <span className="fl">COMPLAINT</span>
              <p>{c.text}</p>
            </div>
          )}
          <div className="receipt-actions no-print">
            <button className="btn-primary" onClick={() => window.print()}>Download / Print</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ user }) {
  const [list, setList] = useState([]);
  const [stats, setStats] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [fc, setFc] = useState("");
  const [fs, setFs] = useState("");
  const [err, setErr] = useState("");
  const isAdmin = user.role === "admin";
  const inst = user.institution || "Institution";
  const instUp = inst.toUpperCase();

  const load = async () => {
    try {
      const qs = new URLSearchParams();
      if (fc) qs.set("category", fc);
      if (fs) qs.set("status", fs);
      const res = await api("/complaints?" + qs.toString());
      setList(res.data || []);
      if (isAdmin) setStats(await api("/analytics"));
    } catch (x) { setErr(x.message); }
  };

  useEffect(() => { load(); }, [fc, fs]);

  const setStatus = async (id, status) => { await api(`/complaints/${id}/status`, "PATCH", { status }); load(); };
  const viewReceipt = async id => { try { setReceipt(await api(`/complaints/${id}`)); } catch (x) { setErr(x.message); } };

  const max = stats ? Math.max(1, ...Object.values(stats.byCategory)) : 1;

  return (
    <>
      {receipt && <Receipt c={receipt} institution={inst} onClose={() => setReceipt(null)} />}

      <div className="page-banner">
        <div className="banner-word">{instUp}</div>
        <div className="banner-content">
          <h1>{isAdmin ? "Dashboard" : "My Complaints"}</h1>
          <p>{isAdmin ? `All complaints for ${inst}.` : "Track your submitted complaints."}</p>
        </div>
      </div>

      <div className="page-body">
        {stats && (
          <>
            <div className="stat-row">
              {[["TOTAL", stats.total], ["OPEN", (stats.byStatus.Submitted || 0) + (stats.byStatus["In Progress"] || 0) + (stats.byStatus.Assigned || 0)], ["CRITICAL", stats.byUrgency.Critical || 0], ["AVG RESOLUTION (H)", stats.avgResolutionHours]].map(([k, v]) => (
                <div className="stat-card" key={k}><div className="fl">{k}</div><div className="stat-val">{v}</div></div>
              ))}
            </div>
            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="fl" style={{ marginBottom: 12 }}>BY CATEGORY</div>
              {Object.entries(stats.byCategory).map(([k, v]) => (
                <div className="bar" key={k}><span>{k}</span><div style={{ width: (v / max) * 55 + "%" }} /><span>{v}</span></div>
              ))}
            </div>
          </>
        )}

        <div className="filter-strip">
          <select value={fc} onChange={e => setFc(e.target.value)}>
            <option value="">All categories</option>
            {["Equipment", "Plumbing", "Electrical", "Network", "Cleanliness", "Safety", "Other"].map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={fs} onChange={e => setFs(e.target.value)}>
            <option value="">All statuses</option>
            {["Submitted", "Assigned", "In Progress", "Resolved"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {err && <p className="err">{err}</p>}

        <div className="panel table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Issue</th><th>Urgency</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {list.map(c => (
                <tr key={c._id}>
                  <td><code className="rid-sm">{c.receiptId || "—"}</code></td>
                  <td>
                    <b>{c.issue || c.category || "—"}</b>
                    {(c.building || c.room) && <><br /><small className="text-muted">{[c.building, c.room].filter(Boolean).join(" · ")}</small></>}
                    <br /><small className="text-muted">{c.text?.slice(0, 70)}{c.text?.length > 70 ? "…" : ""}</small>
                    {isAdmin && c.user?.name && <><br /><small className="text-muted">by {c.user.name}</small></>}
                  </td>
                  <td><UBadge v={c.urgency} /></td>
                  <td>
                    {isAdmin
                      ? <select value={c.status} onChange={e => setStatus(c._id, e.target.value)}>
                          {["Submitted", "Assigned", "In Progress", "Resolved"].map(s => <option key={s}>{s}</option>)}
                        </select>
                      : <SBadge v={c.status} />}
                  </td>
                  <td><button className="btn-ghost sm" onClick={() => viewReceipt(c._id)}>View receipt</button></td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={5}><small className="text-muted">No complaints yet.</small></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo-row">
            <div className="footer-seal">🏛</div>
            <div>
              <div className="footer-pcet">PCET – NUTAN</div>
              <div className="footer-nmiet">NMIET</div>
              <div className="footer-full">Nutan Maharashtra Institute of Engineering and Technology</div>
              <div className="footer-tagline">Autonomous Institute | SPPU Affiliated | DTE CODE 6310</div>
            </div>
          </div>
        </div>
        <div className="footer-links">
          <div className="footer-follow">Follow us Now</div>
          <div className="footer-socials">
            <a href="https://www.instagram.com/nmiet_official" target="_blank" rel="noreferrer" className="social-btn" aria-label="Instagram">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
            </a>
            <a href="https://www.facebook.com/nmiet" target="_blank" rel="noreferrer" className="social-btn" aria-label="Facebook">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            </a>
            <a href="https://www.youtube.com/@nmiet" target="_blank" rel="noreferrer" className="social-btn" aria-label="YouTube">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58a2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>
            </a>
            <a href="https://www.linkedin.com/school/nmiet" target="_blank" rel="noreferrer" className="social-btn" aria-label="LinkedIn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
            </a>
          </div>
          <a href="https://www.nmiet.edu.in" target="_blank" rel="noreferrer" className="footer-website">🌐 www.nmiet.edu.in</a>
        </div>
      </div>
      <div className="footer-copy">© {new Date().getFullYear()} NMIET Complaint Portal · Powered by ComplainX</div>
    </footer>
  );
}

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("cx_user") || "null"));
  const [tab, setTab] = useState("home");
  const [newReceipt, setNewReceipt] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const onAuth = d => {
    localStorage.setItem("cx_token", d.token);
    localStorage.setItem("cx_user", JSON.stringify({ name: d.name, role: d.role, institution: d.institution }));
    setUser({ name: d.name, role: d.role, institution: d.institution });
  };

  const logout = () => { localStorage.clear(); setUser(null); setTab("home"); setNewReceipt(null); setShowForm(false); };

  const onDone = c => { if (c) setNewReceipt(c); setTab("list"); setShowForm(false); };

  const scrollToForm = () => {
    setShowForm(true);
    setTimeout(() => {
      document.getElementById("complaint-form")?.scrollIntoView({ behavior: "smooth" });
    }, 80);
  };

  if (!user) return <Auth onAuth={onAuth} />;

  const inst = user.institution || "Institution";
  const instUp = inst.toUpperCase();
  const isAdmin = user.role === "admin";

  return (
    <>
      {newReceipt && <Receipt c={newReceipt} institution={inst} onClose={() => setNewReceipt(null)} />}

      {(tab === "home" || tab === "submit") && (
        <>
          <section className="hero">
            <div className="hero-word">{instUp}</div>
            <img
              className="campus-img"
              src="/campus.jpg"
              alt="Campus"
              onError={e => { e.target.style.display = "none"; }}
            />
            <div className="hero-bottom-overlay" />

            <nav className="hero-nav">
              <div className="hero-logo" style={{ cursor: "default" }}>
                <Shield />
                <div className="hero-logo-text">
                  ComplainX
                  <small>Complaint Portal</small>
                </div>
              </div>

              <div className="hero-nav-links">
                <button className={tab === "home" ? "active" : ""} onClick={() => { setTab("home"); setShowForm(false); }}>Home</button>
                <button onClick={scrollToForm}>Submit</button>
                <button onClick={() => setTab("list")}>My complaints</button>
                {isAdmin && <button onClick={() => setTab("dashboard")}>Dashboard</button>}
              </div>

              <div className="nav-right">
                <button className="btn-logout" onClick={logout}>Log out</button>
                <button className="hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
                  {menuOpen ? "✕" : "☰"}
                </button>
              </div>
            </nav>

            {menuOpen && (
              <div className="mobile-menu">
                <button onClick={() => { setTab("home"); setShowForm(false); setMenuOpen(false); }}>Home</button>
                <button onClick={() => { scrollToForm(); setMenuOpen(false); }}>Submit a Complaint</button>
                <button onClick={() => { setTab("list"); setMenuOpen(false); }}>My Complaints</button>
                {isAdmin && <button onClick={() => { setTab("dashboard"); setMenuOpen(false); }}>Dashboard</button>}
                <button className="mobile-logout" onClick={logout}>Log out</button>
              </div>
            )}

            <div className="hero-cta">
              <div className="hero-pill">
                🎓 Welcome to {inst}
              </div>
              <h1>Report it.<br />We'll handle it.</h1>
              {!showForm && (
                <button className="hero-submit-btn" onClick={scrollToForm}>
                  📋 Submit a complaint
                </button>
              )}
            </div>

            <button className="how-btn" onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}>
              <span className="how-play">▶</span>
              How it works
            </button>
          </section>

          <section className="how-section" id="how">
            <h2>How It Works</h2>
            <p className="lead">Three simple steps to get your complaint resolved.</p>
            <div className="how-steps">
              <div className="how-step">
                <div className="how-step-num">1</div>
                <h3>Location</h3>
                <p>Tell us where the problem is — building, room, or area on campus.</p>
              </div>
              <div className="how-step">
                <div className="how-step-num">2</div>
                <h3>Details</h3>
                <p>Describe the issue. Our AI analyses it, assigns a category and urgency.</p>
              </div>
              <div className="how-step">
                <div className="how-step-num">3</div>
                <h3>Contact</h3>
                <p>Leave your details and we'll keep you updated on resolution progress.</p>
              </div>
            </div>
          </section>

          {showForm && <ComplaintFlow user={user} onDone={onDone} key="submit" />}
        </>
      )}

      {tab === "list" && <Dashboard user={user} key="list" />}

      <Footer />
    </>
  );
}