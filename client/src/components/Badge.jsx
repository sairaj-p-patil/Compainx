// Badge component for urgency and status display
const URGENCY = {
  Critical: "badge--critical",
  High: "badge--high",
  Medium: "badge--medium",
  Low: "badge--low",
};
const STATUS = {
  Submitted: "badge--submitted",
  Open: "badge--submitted",
  Assigned: "badge--assigned",
  "In Progress": "badge--inprogress",
  Resolved: "badge--resolved",
};

export function UrgencyBadge({ urgency }) {
  if (!urgency) return null;
  return <span className={`badge ${URGENCY[urgency] || "badge--low"}`}>{urgency}</span>;
}

export function StatusBadge({ status }) {
  if (!status) return null;
  return <span className={`badge ${STATUS[status] || "badge--submitted"}`}>{status}</span>;
}
