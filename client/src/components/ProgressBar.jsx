const STEPS = [
  "Organization",
  "Location",
  "Details",
  "Contact",
  "Review",
];

export function ProgressBar({ current }) {
  return (
    <div className="progress-bar">
      {STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "active" : "pending";
        return (
          <div key={label} className={`progress-step progress-step--${state}`}>
            <div className="progress-dot">
              {i < current ? "✓" : i + 1}
            </div>
            <span className="progress-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
