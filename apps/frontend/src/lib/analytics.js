const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

export function initGA() {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined") return;
  if (window.__gaInitialized) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
  window.__gaInitialized = true;
}

export function trackPageView(pagePath) {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: pagePath,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export function trackEvent(eventName, params = {}) {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", eventName, params);
}
