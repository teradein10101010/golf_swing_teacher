import { Link, useLocation } from "react-router-dom";

export default function Footer() {
  const location = useLocation();

  return (
    <footer style={styles.footer}>
      <div style={styles.brand}>Golf Swing Analyzer</div>
      <nav style={styles.nav}>
        <Link
          to="/terms"
          style={{
            ...styles.navItem,
            ...(location.pathname === "/terms" ? styles.navActive : {}),
          }}
        >
          利用規約
        </Link>
        <Link
          to="/privacy"
          style={{
            ...styles.navItem,
            ...(location.pathname === "/privacy" ? styles.navActive : {}),
          }}
        >
          プライバシーポリシー
        </Link>
        <Link
          to="/contact"
          style={{
            ...styles.navItem,
            ...(location.pathname === "/contact" ? styles.navActive : {}),
          }}
        >
          お問い合わせ
        </Link>
        <Link
          to="/legal"
          style={{
            ...styles.navItem,
            ...(location.pathname === "/legal" ? styles.navActive : {}),
          }}
        >
          特定商取引法に基づく表記
        </Link>
      </nav>
      <div style={styles.note}>
        © {new Date().getFullYear()} Golf Swing Analyzer
      </div>
    </footer>
  );
}

const styles = {
  footer: {
    marginTop: 24,
    padding: "20px 24px",
    borderRadius: 16,
    background: "rgba(15, 32, 39, 0.8)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#cbd5e1",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  brand: {
    fontSize: 14,
    fontWeight: 700,
    color: "#fff",
  },
  nav: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
  },
  navItem: {
    padding: "6px 12px",
    borderRadius: 999,
    textDecoration: "none",
    color: "#cbd5e1",
    fontSize: 12,
  },
  navActive: {
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
  },
  note: {
    fontSize: 12,
    color: "#94a3b8",
  },
};
