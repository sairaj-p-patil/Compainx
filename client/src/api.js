// Shared API helper used by all components
const TOKEN_KEY = "cx_token";

export const api = async (path, method = "GET", body) => {
  const t = localStorage.getItem(TOKEN_KEY);
  const r = await fetch("/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(t && { Authorization: "Bearer " + t }),
    },
    body: body && JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Something went wrong");
  return d;
};

export const apiForm = async (path, formData) => {
  const t = localStorage.getItem(TOKEN_KEY);
  const r = await fetch("/api" + path, {
    method: "POST",
    headers: { ...(t && { Authorization: "Bearer " + t }) },
    body: formData,
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Upload failed");
  return d;
};
