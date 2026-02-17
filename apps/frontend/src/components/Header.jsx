import { Link, useLocation } from "react-router-dom";
import Auth from "./Auth";
import { FREE_ACCESS, SUPABASE_CONFIGURED } from "../lib/supabase";
import useIsMobile from "../hooks/useIsMobile";

const FREE_ACCESS_EFFECTIVE = FREE_ACCESS || !SUPABASE_CONFIGURED;

export default function Header({ user, onUserChange }) {
  const location = useLocation();
  const isMobile = useIsMobile();

  return (
    <header style={{ ...styles.header, ...(isMobile ? styles.headerMobile : {}) }}>
      {/* Logo */}
      <div style={{ ...styles.logo, ...(isMobile ? styles.logoMobile : {}) }}>
        🏌️ Golf Swing Analyzer
      </div>

      {/* Nav */}
      <nav style={{ ...styles.nav, ...(isMobile ? styles.navMobile : {}) }}>
        <Link
          to="/"
          style={{
            ...styles.navItem,
            ...(isMobile ? styles.navItemMobile : {}),
            ...(location.pathname === "/" ? styles.navActive : {}),
          }}
        >
          単体分析
        </Link>
        <Link
          to="/compare"
          style={{
            ...styles.navItem,
            ...(isMobile ? styles.navItemMobile : {}),
            ...(location.pathname === "/compare" ? styles.navActive : {}),
          }}
        >
          比較分析
        </Link>
      </nav>

      {/* Auth */}
      {!FREE_ACCESS_EFFECTIVE && <Auth onUserChange={onUserChange} />}
    </header>
  );
}

const styles = {
  header: {
    height: 72,
    padding: "0 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    background: "rgba(15, 32, 39, 0.8)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#fff",
    position: "sticky",
    top: "env(safe-area-inset-top, 0px)",
    zIndex: 40,
  },
  logo: {
    fontSize: 18,
    fontWeight: 700,
  },
  nav: {
    display: "flex",
    gap: 16,
  },
  navItem: {
    padding: "8px 14px",
    borderRadius: 999,
    textDecoration: "none",
    color: "#cbd5e1",
    fontSize: 14,
  },
  navActive: {
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
  },
  headerMobile: {
    height: "auto",
    padding: "14px",
    gap: 12,
    flexDirection: "column",
    alignItems: "stretch",
  },
  logoMobile: {
    fontSize: 16,
    textAlign: "center",
  },
  navMobile: {
    width: "100%",
    justifyContent: "center",
    gap: 10,
  },
  navItemMobile: {
    padding: "10px 14px",
    fontSize: 13,
    minWidth: 110,
    textAlign: "center",
  },
};
