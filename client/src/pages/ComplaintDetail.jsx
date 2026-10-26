import { useState, useEffect } from "react";
import { api } from "../api";
import { UrgencyBadge, StatusBadge } from "../components/Badge";
import { SkeletonCard } from "../components/Skeleton";
import { useToast } from "../components/Toast";

const STATUSES = ["Submitted", "Assigned", "In Progress", "Resolved"];

function Field({ label, value }) {
  if (!value && value !== false) return null;
  return (
    <div className="detail-field">
      <span className="k">{label}</span>
      <span className="v">{String(value)}</span>
    </div>
  );
}

function Timeline({ history }) {
  if (!history?.length) return null;
  return (
    <div className="timeline">
      {history.map((h, i) => (
        <div key={i} className="timeline-item">
          <div className="timeline-dot" />
          <div className="timeline-body">
            <StatusBadge status={h.status} />
            <span className="timeline-meta">{new Date(h.at).toLocaleString()} {h.by && `· ${h.by}`}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ComplaintDetail({ id, role, onBack }) {
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const toast = useToast();
  const isAdmin = role === "admin";

  const load = async () => {
    setLoading(true); setErr("");
    try { setComplaint(await api(`/complaints/${id}`)); }
    catch (x) { setErr(x.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const setStatus = async (status) => {
    try {
      await api(`/complaints/${id}/status`, "PATCH", { status });
      toast(`Status updated to "${status}"`);
      load();
    } catch (x) { toast(x.message, "error"); }
  };

  if (loading) return <div style={{ marginTop: 24 }}><SkeletonCard /><SkeletonCard /></div>;
  if (err) return <p className="err">{err}</p>;
  if (!complaint) return null;

  const c = complaint;
  const loc = [c.structuredLocation?.building, c.structuredLocation?.floor, c.structuredLocation?.room].filter(Boolean).join(", ");

  return (
    <>
      <div className="detail-header">
        <button className="btn g" onClick={onBack}>← Back</button>
        <code className="complaint-id-sm">{c.complaintId || "—"}</code>
      </div>

      <h1>{c.title || c.issue || "Complaint"}</h1>

      <div className="badge-row">
        <UrgencyBadge urgency={c.urgency} />
        <StatusBadge status={c.status} />
        {c.isAnonymous && <span className="badge badge--anon">Anonymous</span>}
      </div>

      <div className="detail-grid">
        {/* ── Main info ── */}
        <div className="card detail-card">
          <div className="section-label">Complaint</div>
          <Field label="Description" value={c.text} />
          <Field label="Category" value={c.category} />
          <Field label="Issue type" value={c.issue} />
          <Field label="Routed to" value={c.department} />
          <Field label="Incident time" value={c.incidentTime ? new Date(c.incidentTime).toLocaleString() : null} />
          <Field label="AI detected location" value={c.nlpLocation} />
          <Field label="Deadline context" value={c.deadline} />
          <Field label="Duration reported" value={c.duration} />
          <Field label="Sentiment" value={c.sentiment} />
          <Field label="Urgency score" value={c.urgency_score} />
          <Field label="Submitted" value={new Date(c.createdAt).toLocaleString()} />
          {c.user?.name && <Field label="Submitted by" value={c.isAnonymous ? "Anonymous" : c.user.name} />}
        </div>

        {/* ── Organization ── */}
        <div className="card detail-card">
          <div className="section-label">Organization</div>
          <Field label="Name" value={c.organization?.name} />
          <Field label="Type" value={c.organization?.type} />
          <Field label="Department" value={c.organization?.department} />
          <div className="section-label" style={{ marginTop: 16 }}>Location</div>
          <Field label="Building" value={c.structuredLocation?.building} />
          <Field label="Floor" value={c.structuredLocation?.floor} />
          <Field label="Room / Area" value={c.structuredLocation?.room} />
          {!loc && <span className="mut">No structured location provided.</span>}
          <div className="section-label" style={{ marginTop: 16 }}>Contact</div>
          <Field label="Contact" value={c.contact?.value} />
          <Field label="Method" value={c.contact?.method} />
        </div>
      </div>

      {/* ── Attachments ── */}
      {c.attachments?.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-label">Attachments</div>
          <div className="attachments-grid">
            {c.attachments.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer">
                <img src={a.url} alt={a.filename} className="thumb" />
                <small>{a.filename}</small>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── Status timeline ── */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-label">Status history</div>
        <Timeline history={c.statusHistory} />
        {!c.statusHistory?.length && <small className="mut">No status updates yet.</small>}
        {isAdmin && (
          <div className="row" style={{ marginTop: 16 }}>
            <select defaultValue={c.status} onChange={e => setStatus(e.target.value)}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>
    </>
  );
}
