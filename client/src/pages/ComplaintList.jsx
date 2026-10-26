import { useState, useEffect } from "react";
import { api } from "../api";
import { UrgencyBadge, StatusBadge } from "../components/Badge";
import { SkeletonRow } from "../components/Skeleton";
import { useToast } from "../components/Toast";

const CATEGORIES = ["", "Equipment", "Plumbing", "Electrical", "Network", "Cleanliness", "Safety", "Other"];
const URGENCIES = ["", "Critical", "High", "Medium", "Low"];
const STATUSES = ["", "Submitted", "Open", "Assigned", "In Progress", "Resolved"];

const EMPTY_FILTERS = { organization: "", category: "", urgency: "", status: "", from: "", to: "" };

export function ComplaintList({ role, onSelect }) {
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [applied, setApplied] = useState({ ...EMPTY_FILTERS });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const isAdmin = role === "admin";
  const toast = useToast();

  const buildQs = (f, p) => {
    const q = new URLSearchParams({ page: p, limit: 20 });
    Object.entries(f).forEach(([k, v]) => v && q.set(k, v));
    return "?" + q.toString();
  };

  const load = async (f = applied, p = page) => {
    setLoading(true); setErr("");
    try {
      const res = await api("/complaints" + buildQs(f, p));
      setData(res.data || []);
      setTotal(res.total || 0);
      setPages(res.pages || 1);
      if (isAdmin) setStats(await api("/analytics"));
    } catch (x) { setErr(x.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, applied]);

  const search = () => { setPage(1); setApplied({ ...filters }); };
  const reset = () => { setFilters({ ...EMPTY_FILTERS }); setApplied({ ...EMPTY_FILTERS }); setPage(1); };

  const setStatus = async (id, status) => {
    try {
      await api(`/complaints/${id}/status`, "PATCH", { status });
      toast(`Status updated to "${status}"`);
      load();
    } catch (x) { toast(x.message, "error"); }
  };

  const setF = (k) => (e) => setFilters(f => ({ ...f, [k]: e.target.value }));

  const max = stats ? Math.max(1, ...Object.values(stats.byCategory)) : 1;

  return (
    <>
      <h1>{isAdmin ? "Dashboard" : "My complaints"}</h1>
      <p className="sub">
        {isAdmin ? "All complaints, prioritised by urgency." : "Track the status of what you submitted."}
      </p>

      {/* ── Admin stats ── */}
      {stats && (
        <>
          <div className="stats-grid">
            {[["Total", stats.total], ["Open", (stats.byStatus.Open || 0) + (stats.byStatus.Submitted || 0)], ["Critical", stats.byUrgency.Critical || 0], ["Avg resolution (h)", stats.avgResolutionHours]].map(([k, v]) => (
              <div className="card stat-card" key={k}>
                <div className="k">{k}</div>
                <div className="stat-value">{v}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <div className="k">By category</div>
            {Object.entries(stats.byCategory).map(([k, v]) => (
              <div className="bar" key={k}>
                <span>{k}</span>
                <div style={{ width: (v / max) * 60 + "%" }} />
                <span>{v}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Filter bar ── */}
      <div className="filter-bar">
        <input className="filter-input" placeholder="Organization name…" value={filters.organization} onChange={setF("organization")} />
        <select value={filters.category} onChange={setF("category")}>
          <option value="">All categories</option>
          {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={filters.urgency} onChange={setF("urgency")}>
          <option value="">All urgencies</option>
          {URGENCIES.slice(1).map(u => <option key={u}>{u}</option>)}
        </select>
        <select value={filters.status} onChange={setF("status")}>
          <option value="">All statuses</option>
          {STATUSES.slice(1).map(s => <option key={s}>{s}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={setF("from")} title="From date" />
        <input type="date" value={filters.to} onChange={setF("to")} title="To date" />
        <button className="btn" onClick={search}>Search</button>
        <button className="btn g" onClick={reset}>Reset</button>
      </div>

      {err && <p className="err">{err}</p>}

      <div className="card tw" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Complaint</th>
              <th>Organization</th>
              <th>Urgency</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
              : data.map(c => (
                <tr key={c._id} className="clickable-row" onClick={() => onSelect(c._id)}>
                  <td><code className="complaint-id-sm">{c.complaintId || "—"}</code></td>
                  <td>
                    <b>{c.title || c.issue || "—"}</b>
                    <br /><small>{c.text?.slice(0, 80)}{c.text?.length > 80 ? "…" : ""}</small>
                    {isAdmin && c.user && !c.isAnonymous && <><br /><small>by {c.user.name}</small></>}
                    {c.isAnonymous && <><br /><small className="anon-tag">Anonymous</small></>}
                    {c.votes > 0 && <><br /><small>+{c.votes} upvotes</small></>}
                  </td>
                  <td>
                    <span>{c.organization?.name || "—"}</span>
                    {c.organization?.type && <><br /><small>{c.organization.type}</small></>}
                    {c.department && <><br /><small>{c.department}</small></>}
                  </td>
                  <td><UrgencyBadge urgency={c.urgency} /></td>
                  <td>
                    {isAdmin ? (
                      <select
                        value={c.status}
                        onClick={e => e.stopPropagation()}
                        onChange={e => { e.stopPropagation(); setStatus(c._id, e.target.value); }}
                      >
                        {STATUSES.slice(1).map(s => <option key={s}>{s}</option>)}
                      </select>
                    ) : <StatusBadge status={c.status} />}
                  </td>
                </tr>
              ))
            }
            {!loading && data.length === 0 && (
              <tr><td colSpan={5}><small>No complaints found.</small></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div className="pagination">
          <button className="btn g" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span>Page {page} of {pages} · {total} total</span>
          <button className="btn g" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </>
  );
}
