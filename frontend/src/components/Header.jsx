import { NavLink } from "react-router-dom";

export default function Header() {
  return (
    <header style={styles.header}>
      <div style={styles.logo}>🏌️ Swing Analyzer</div>

      <nav style={styles.nav}>
        <NavLink
          to="/"
          end
          style={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
        >
          単体分析
        </NavLink>

        <NavLink
          to="/compare"
          style={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
        >
          比較分析
        </NavLink>
      </nav>
    </header>
  );
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 24px",
    background: "linear-gradient(90deg, #0f2027, #203a43)",
    color: "#ffffff",
    boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
  },
  logo: {
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  nav: {
    display: "flex",
    gap: 12,
  },
  link: {
    color: "#b0c4cc",
    textDecoration: "none",
    padding: "6px 14px",
    borderRadius: 8,
    fontSize: 14,
    transition: "all 0.2s ease",
  },
  activeLink: {
    color: "#ffffff",
    background: "rgba(255,255,255,0.15)",
    textDecoration: "none",
    padding: "6px 14px",
    borderRadius: 8,
    fontSize: 14,
  },
};
