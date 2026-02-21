const normalizeBase = (base) => String(base || "").trim().replace(/\/+$/, "");

const envBase = normalizeBase(import.meta.env.VITE_API_BASE);

export const API_BASE = (() => {
  if (envBase) return envBase;
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
})();

