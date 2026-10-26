import { useState, useEffect, useRef } from "react";
import { api } from "../api";

export function OrgAutocomplete({ value, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef(null);
  const wrapper = useRef(null);

  useEffect(() => {
    clearTimeout(debounce.current);
    if (value.length < 2) { setSuggestions([]); return; }
    debounce.current = setTimeout(async () => {
      try {
        const res = await api(`/organizations/suggest?q=${encodeURIComponent(value)}`);
        setSuggestions(res);
        setOpen(res.length > 0);
      } catch { setSuggestions([]); }
    }, 400);
    return () => clearTimeout(debounce.current);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (!wrapper.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (name) => { onChange(name); setOpen(false); };

  return (
    <div className="autocomplete" ref={wrapper}>
      <input
        type="text"
        placeholder="e.g. MIT College of Engineering"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {open && (
        <ul className="autocomplete-list">
          {suggestions.map(s => (
            <li key={s} onMouseDown={() => pick(s)}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
