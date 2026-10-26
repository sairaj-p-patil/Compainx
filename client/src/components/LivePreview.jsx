import { useState, useEffect, useRef } from "react";
import { api } from "../api";
import { UrgencyBadge } from "./Badge";

export function LivePreview({ text, onSuggestion }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!text || text.trim().length < 15) { setResult(null); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const r = await api("/complaints/analyze", "POST", { text });
        setResult(r);
        setError(null);
        if (r.location && onSuggestion) onSuggestion(r.location);
      } catch (e) {
        setResult(null);
        setError(e.message);
      } finally { setLoading(false); }
    }, 800);
    return () => clearTimeout(timer.current);
  }, [text]);

  if (!text || text.trim().length < 15) return null;

  return (
    <div className="live-preview">
      {loading ? (
        <span className="live-preview__loading">Analyzing…</span>
      ) : error ? (
        <span className="live-preview__error" style={{ color: 'red' }}>{error}</span>
      ) : result ? (
        <div className="live-preview__content">
          <span className="live-preview__label">AI preview</span>
          <span><strong>{result.category}</strong> · routed to <em>{result.department}</em></span>
          <UrgencyBadge urgency={result.urgency} />
          {result.duplicates?.length > 0 && (
            <span className="live-preview__dup">
              ⚠ Similar complaint exists ({Math.round(result.duplicates[0].similarity * 100)}% match)
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
