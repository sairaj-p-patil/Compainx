import { useState, useRef } from "react";
import { api, apiForm } from "../api";
import { ProgressBar } from "../components/ProgressBar";
import { OrgAutocomplete } from "../components/OrgAutocomplete";
import { LivePreview } from "../components/LivePreview";
import { UrgencyBadge } from "../components/Badge";
import { useToast } from "../components/Toast";

const ORG_TYPES = ["", "College", "School", "Hospital", "Company", "Hostel", "Government", "Other"];
const CONTACT_METHODS = ["email", "phone", "none"];

const EMPTY = {
  orgName: "", orgType: "", orgDept: "",
  building: "", floor: "", room: "",
  title: "", text: "", incidentTime: "", photo: null,
  contactValue: "", contactMethod: "email", isAnonymous: false,
};

const Label = ({ text, req }) => (
  <label className="form-label">{text}{req && <span className="req">*</span>}</label>
);
const Group = ({ children, style }) => <div className="form-group" style={style}>{children}</div>;
const ErrMsg = ({ msg }) => msg ? <p className="err">{msg}</p> : null;

function ReviewRow({ label, value }) {
  if (!value && value !== false) return null;
  return (
    <div className="review-row">
      <span className="review-label">{label}</span>
      <span className="review-value">{String(value)}</span>
    </div>
  );
}

export function ComplaintForm({ user, onSuccess }) {
  const [step, setStep] = useState(0); // 0-4
  const [form, setForm] = useState({ ...EMPTY, contactValue: user?.email || "" });
  const [errors, setErrors] = useState({});
  const [nlpSuggestion, setNlpSuggestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(null); // { complaintId, department }
  const [thumbnail, setThumbnail] = useState(null);
  const fileRef = useRef();
  const toast = useToast();

  const set = (k) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [k]: val }));
    setErrors(er => ({ ...er, [k]: "" }));
  };

  // Per-section validation
  const validate = (s) => {
    const errs = {};
    if (s === 0) {
      if (!form.orgName.trim()) errs.orgName = "Organization name is required";
    }
    if (s === 2) {
      if (!form.title.trim()) errs.title = "Title is required";
      if (!form.text.trim()) errs.text = "Description is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => { if (validate(step)) setStep(s => Math.min(4, s + 1)); };
  const prev = () => setStep(s => Math.max(0, s - 1));
  const jumpTo = (s) => setStep(s);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) { toast("Only jpg, png, webp images allowed", "error"); return; }
    if (file.size > 5 * 1024 * 1024) { toast("File must be under 5 MB", "error"); return; }
    setForm(f => ({ ...f, photo: file }));
    setThumbnail(URL.createObjectURL(file));
  };

  const submit = async () => {
    setBusy(true);
    try {
      const body = {
        title: form.title.trim(),
        text: form.text.trim(),
        organization: { name: form.orgName.trim(), type: form.orgType, department: form.orgDept.trim() },
        structuredLocation: { building: form.building.trim(), floor: form.floor.trim(), room: form.room.trim() },
        incidentTime: form.incidentTime || undefined,
        contact: { value: form.contactValue.trim(), method: form.contactMethod },
        isAnonymous: form.isAnonymous,
      };
      const c = await api("/complaints", "POST", body);

      // upload photo if present
      if (form.photo) {
        const fd = new FormData();
        fd.append("files", form.photo);
        await apiForm(`/complaints/${c._id}/attachments`, fd);
      }

      setSuccess({ complaintId: c.complaintId, department: c.department });
      toast("Complaint submitted successfully!");
    } catch (e) {
      toast(e.message, "error");
    }
    setBusy(false);
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="card success-screen">
        <div className="success-icon">✓</div>
        <h2>Complaint Submitted</h2>
        <p className="sub">Your complaint has been received and will be reviewed shortly.</p>
        <div className="complaint-id-box">
          <span className="complaint-id-label">Complaint ID</span>
          <span className="complaint-id">{success.complaintId}</span>
        </div>
        {success.department && <p>Routed to: <strong>{success.department}</strong></p>}
        <div className="row" style={{ justifyContent: "center", marginTop: 20 }}>
          <button className="btn" onClick={onSuccess}>Track this complaint</button>
          <button className="btn g" onClick={() => { setSuccess(null); setForm({ ...EMPTY, contactValue: user?.email || "" }); setStep(0); }}>
            Submit another
          </button>
        </div>
      </div>
    );
  }

  // ── Section renderers ───────────────────────────────────────────────────────
  const Section1 = () => (
    <div className="form-section">
      <h2 className="section-title">Organization details</h2>
      <Group>
        <Label text="Organization name" req />
        <OrgAutocomplete value={form.orgName} onChange={v => { setForm(f => ({ ...f, orgName: v })); setErrors(e => ({ ...e, orgName: "" })); }} />
        <ErrMsg msg={errors.orgName} />
      </Group>
      <Group>
        <Label text="Organization type" />
        <select value={form.orgType} onChange={set("orgType")}>
          {ORG_TYPES.map(t => <option key={t} value={t}>{t || "— Select —"}</option>)}
        </select>
      </Group>
      <Group>
        <Label text="Department / Section" />
        <input placeholder="e.g. Computer Science, HR, Ward 3" value={form.orgDept} onChange={set("orgDept")} />
      </Group>
    </div>
  );

  const Section2 = () => (
    <div className="form-section">
      <h2 className="section-title">Location</h2>
      {nlpSuggestion && (
        <div className="nlp-suggestion">
          <span>AI detected location: <strong>{nlpSuggestion}</strong></span>
          <button className="link" onClick={() => {
            setForm(f => ({ ...f, building: nlpSuggestion }));
            setNlpSuggestion("");
          }}>Use this</button>
          <button className="link" style={{ color: "var(--mut)" }} onClick={() => setNlpSuggestion("")}>Dismiss</button>
        </div>
      )}
      <div className="grid3">
        <Group>
          <Label text="Building / Block" />
          <input placeholder="Block A / Building 3" value={form.building} onChange={set("building")} />
        </Group>
        <Group>
          <Label text="Floor" />
          <input placeholder="1st, Ground, etc." value={form.floor} onChange={set("floor")} />
        </Group>
        <Group>
          <Label text="Room / Area" />
          <input placeholder="Lab 4, Room 203, Corridor" value={form.room} onChange={set("room")} />
        </Group>
      </div>
    </div>
  );

  const Section3 = () => (
    <div className="form-section">
      <h2 className="section-title">Complaint details</h2>
      <Group>
        <Label text="Title" req />
        <input placeholder="Short summary of the problem" value={form.title} onChange={set("title")} maxLength={150} />
        <ErrMsg msg={errors.title} />
      </Group>
      <Group>
        <Label text="Description" req />
        <textarea
          placeholder="The projector in Lab 4 hasn't been working for three days and our practical exam is tomorrow."
          value={form.text}
          onChange={set("text")}
          rows={5}
        />
        <ErrMsg msg={errors.text} />
        <LivePreview text={form.text} onSuggestion={setNlpSuggestion} />
      </Group>
      <Group>
        <Label text="When did it start?" />
        <input type="datetime-local" value={form.incidentTime} onChange={set("incidentTime")} style={{ width: "auto" }} />
      </Group>
      <Group>
        <Label text="Attach a photo (jpg / png / webp, max 5 MB)" />
        <input type="file" accept="image/jpeg,image/png,image/webp" ref={fileRef} style={{ display: "none" }} onChange={handleFile} />
        {thumbnail ? (
          <div className="thumb-row">
            <img src={thumbnail} className="thumb" alt="preview" />
            <button className="link" onClick={() => { setForm(f => ({ ...f, photo: null })); setThumbnail(null); fileRef.current.value = ""; }}>Remove</button>
          </div>
        ) : (
          <button className="btn g" onClick={() => fileRef.current.click()}>Choose image</button>
        )}
      </Group>
    </div>
  );

  const Section4 = () => (
    <div className="form-section">
      <h2 className="section-title">Contact &amp; options</h2>
      <Group>
        <Label text="Contact email or phone" />
        <input placeholder="yourname@email.com or +91 9876543210" value={form.contactValue} onChange={set("contactValue")} />
      </Group>
      <Group>
        <Label text="Preferred contact method" />
        <div className="radio-row">
          {CONTACT_METHODS.map(m => (
            <label key={m} className="radio-label">
              <input type="radio" name="contactMethod" value={m} checked={form.contactMethod === m} onChange={set("contactMethod")} />
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </label>
          ))}
        </div>
      </Group>
      <Group>
        <label className="toggle-label">
          <input type="checkbox" checked={form.isAnonymous} onChange={set("isAnonymous")} />
          <span>Submit anonymously — your name won't be shown to staff</span>
        </label>
      </Group>
    </div>
  );

  const Section5 = () => (
    <div className="form-section">
      <h2 className="section-title">Review &amp; submit</h2>
      <div className="review-block">
        <div className="review-section-header">
          Organization
          <button className="link review-edit" onClick={() => jumpTo(0)}>Edit</button>
        </div>
        <ReviewRow label="Name" value={form.orgName} />
        <ReviewRow label="Type" value={form.orgType} />
        <ReviewRow label="Department" value={form.orgDept} />
      </div>
      <div className="review-block">
        <div className="review-section-header">
          Location
          <button className="link review-edit" onClick={() => jumpTo(1)}>Edit</button>
        </div>
        <ReviewRow label="Building" value={form.building} />
        <ReviewRow label="Floor" value={form.floor} />
        <ReviewRow label="Room" value={form.room} />
      </div>
      <div className="review-block">
        <div className="review-section-header">
          Details
          <button className="link review-edit" onClick={() => jumpTo(2)}>Edit</button>
        </div>
        <ReviewRow label="Title" value={form.title} />
        <ReviewRow label="Description" value={form.text} />
        <ReviewRow label="Incident time" value={form.incidentTime} />
        <ReviewRow label="Photo" value={form.photo?.name} />
      </div>
      <div className="review-block">
        <div className="review-section-header">
          Contact
          <button className="link review-edit" onClick={() => jumpTo(3)}>Edit</button>
        </div>
        <ReviewRow label="Contact" value={form.contactValue} />
        <ReviewRow label="Method" value={form.contactMethod} />
        <ReviewRow label="Anonymous" value={form.isAnonymous ? "Yes" : "No"} />
      </div>
    </div>
  );

  const sections = [<Section1 />, <Section2 />, <Section3 />, <Section4 />, <Section5 />];

  return (
    <div className="complaint-form-wrap">
      <h1>New Complaint</h1>
      <p className="sub">Fill in the details. We handle analysis, routing, and prioritization.</p>
      <div className="card" style={{ padding: "24px 24px 16px" }}>
        <ProgressBar current={step} />
        <div className="form-body">
          {sections[step]}
        </div>
        <div className="form-nav">
          {step > 0 && <button className="btn g" onClick={prev}>← Back</button>}
          <div style={{ flex: 1 }} />
          {step < 4 ? (
            <button className="btn" onClick={next}>Next →</button>
          ) : (
            <button className="btn" disabled={busy} onClick={submit}>
              {busy ? "Submitting…" : "Submit complaint"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
