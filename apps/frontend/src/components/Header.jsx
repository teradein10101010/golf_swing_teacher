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
        🏌️ ゴルフスイング解析
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
          <span style={styles.navItemTitle}>単体スイング解析</span>
          <span style={styles.navItemSub}>1本の動画を詳しく</span>
        </Link>
        <Link
          to="/compare"
          style={{
            ...styles.navItem,
            ...(isMobile ? styles.navItemMobile : {}),
            ...(location.pathname === "/compare" ? styles.navActive : {}),
          }}
        >
          <span style={styles.navItemTitle}>2本比較解析</span>
          <span style={styles.navItemSub}>2本を並べて比較</span>
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
    background: "rgba(255, 250, 241, 0.9)",
    backdropFilter: "blur(10px)",
    border: "1px solid var(--line)",
    color: "var(--text)",
    position: "sticky",
    top: "env(safe-area-inset-top, 0px)",
    zIndex: 40,
    boxShadow: "0 12px 28px var(--shadow)",
  },
  logo: {
    fontSize: 18,
    fontWeight: 700,
    textShadow: "0 1px 6px rgba(255, 255, 255, 0.8)",
  },
  nav: {
    display: "flex",
    gap: 16,
  },
  navItem: {
    padding: "8px 16px",
    borderRadius: 12,
    textDecoration: "none",
    color: "var(--text-muted)",
    fontSize: 14,
    background: "var(--surface)",
    border: "1px solid var(--line)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    minWidth: 150,
  },
  navActive: {
    background: "var(--accent-soft)",
    color: "var(--text)",
    border: "1px solid rgba(181, 122, 74, 0.45)",
  },
  navItemTitle: {
    fontWeight: 700,
    letterSpacing: 0.2,
  },
  navItemSub: {
    fontSize: 11,
    color: "var(--text-muted)",
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
    padding: "10px 12px",
    fontSize: 13,
    minWidth: 140,
    textAlign: "center",
  },
};
