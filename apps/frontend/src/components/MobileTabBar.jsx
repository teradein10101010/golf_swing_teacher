import { Link, useLocation } from "react-router-dom";
import useIsMobile from "../hooks/useIsMobile";

const MAIN_ROUTES = new Set(["/", "/compare"]);

export default function MobileTabBar() {
  const isMobile = useIsMobile();
  const location = useLocation();

  if (!isMobile || !MAIN_ROUTES.has(location.pathname)) {
    return null;
  }

  return (
    <nav style={styles.wrap} aria-label="mobile-bottom-tab">
      <Link
        to="/"
        style={{
          ...styles.tab,
          ...(location.pathname === "/" ? styles.tabActive : {}),
        }}
      >
        <span style={styles.icon}>🎯</span>
        <span style={styles.label}>単体</span>
      </Link>
      <Link
        to="/compare"
        style={{
          ...styles.tab,
          ...(location.pathname === "/compare" ? styles.tabActive : {}),
        }}
      >
        <span style={styles.icon}>⚖️</span>
        <span style={styles.label}>比較</span>
      </Link>
    </nav>
  );
}

const styles = {
  wrap: {
    position: "fixed",
    left: 12,
    right: 12,
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
    padding: 8,
    borderRadius: 16,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    background: "rgba(15, 23, 42, 0.88)",
    border: "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(12px)",
    zIndex: 60,
    boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
  },
  tab: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    minHeight: 44,
    borderRadius: 12,
    textDecoration: "none",
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 600,
  },
  tabActive: {
    color: "#fff",
    background: "linear-gradient(135deg,#22c55e,#16a34a)",
  },
  icon: {
    fontSize: 15,
    lineHeight: 1,
  },
  label: {
    lineHeight: 1.1,
  },
};
