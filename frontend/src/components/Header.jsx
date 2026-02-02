import { Link, useLocation } from "react-router-dom";
import Auth from "./Auth";

export default function Header({ user, onUserChange }) {
  const location = useLocation();

  return (
    <header style={styles.header}>
      {/* Logo */}
      <div style={styles.logo}>🏌️ Golf Swing Analyzer</div>

      {/* Nav */}
      <nav style={styles.nav}>
        <Link
          to="/"
          style={{
            ...styles.navItem,
            ...(location.pathname === "/" ? styles.navActive : {}),
          }}
        >
          単体分析
        </Link>
        <Link
          to="/compare"
          style={{
            ...styles.navItem,
            ...(location.pathname === "/compare" ? styles.navActive : {}),
          }}
        >
          比較分析
        </Link>
      </nav>

      {/* Auth */}
      <Auth onUserChange={onUserChange} />
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
};
