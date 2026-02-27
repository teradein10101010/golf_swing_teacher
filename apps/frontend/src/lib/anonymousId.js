const STORAGE_KEY = "anon.analysis.id.v1";

const generateAnonymousId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  const chars = "abcdef0123456789";
  let out = "";
  for (let i = 0; i < 32; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
};

export const getAnonymousId = () => {
  try {
    const cached = window.localStorage.getItem(STORAGE_KEY);
    if (cached && /^[a-f0-9]{32}$/.test(cached)) return cached;
    const next = generateAnonymousId();
    window.localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return generateAnonymousId();
  }
};
