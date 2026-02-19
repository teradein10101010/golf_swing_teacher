const GA4_MEASUREMENT_ID = String(import.meta.env.VITE_GA4_MEASUREMENT_ID || "").trim();

export const ANALYTICS_ENABLED = Boolean(GA4_MEASUREMENT_ID);

const EVENT_NAME_MAX = 40;
const PARAM_VALUE_MAX = 100;

const ensureWindow = () => typeof window !== "undefined";

const clampString = (value, max = PARAM_VALUE_MAX) => {
  const text = String(value ?? "");
  return text.length > max ? text.slice(0, max) : text;
};

const sanitizeValue = (value) => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return clampString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  return clampString(JSON.stringify(value));
};

const sanitizeParams = (params = {}) => {
  const sanitized = {};
  Object.entries(params).forEach(([key, value]) => {
    const nextValue = sanitizeValue(value);
    if (nextValue !== undefined) {
      sanitized[key] = nextValue;
    }
  });
  return sanitized;
};

export const initAnalytics = () => {
  if (!ANALYTICS_ENABLED || !ensureWindow()) return;
  if (window.__ga4Initialized) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  window.gtag("js", new Date());
  window.gtag("config", GA4_MEASUREMENT_ID, {
    send_page_view: false,
    anonymize_ip: true,
  });

  window.__ga4Initialized = true;
};

export const trackPageView = (path) => {
  if (!ANALYTICS_ENABLED || !ensureWindow() || typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
};

export const trackEvent = (eventName, params = {}) => {
  if (!ANALYTICS_ENABLED || !ensureWindow() || typeof window.gtag !== "function") return;
  if (!eventName) return;
  window.gtag("event", clampString(eventName, EVENT_NAME_MAX), sanitizeParams(params));
};
