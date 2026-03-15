import { Link, useLocation } from "react-router-dom";
import useIsMobile from "../hooks/useIsMobile";

export default function Footer() {
  const location = useLocation();
  const isMobile = useIsMobile();

  return (
    <footer style={{ ...styles.footer, ...(isMobile ? styles.footerMobile : {}) }}>
      <div style={{ ...styles.brand, ...(isMobile ? styles.brandMobile : {}) }}>
        ゴルフスイング解析
      </div>
      <nav style={{ ...styles.nav, ...(isMobile ? styles.navMobile : {}) }}>
        <Link
          to="/terms"
          style={{
            ...styles.navItem,
            ...(isMobile ? styles.navItemMobile : {}),
            ...(location.pathname === "/terms" ? styles.navActive : {}),
          }}
        >
          利用規約
        </Link>
        <Link
          to="/privacy"
          style={{
            ...styles.navItem,
            ...(isMobile ? styles.navItemMobile : {}),
            ...(location.pathname === "/privacy" ? styles.navActive : {}),
          }}
        >
          プライバシーポリシー
        </Link>
        <Link
          to="/contact"
          style={{
            ...styles.navItem,
            ...(isMobile ? styles.navItemMobile : {}),
            ...(location.pathname === "/contact" ? styles.navActive : {}),
          }}
        >
          お問い合わせ
        </Link>
      </nav>
      <div style={{ ...styles.note, ...(isMobile ? styles.noteMobile : {}) }}>
        © {new Date().getFullYear()} ゴルフスイング解析
      </div>
    </footer>
  );
}

const styles = {
  footer: {
    marginTop: 24,
    padding: "20px 24px",
    borderRadius: 16,
    background: "rgba(255, 250, 241, 0.9)",
    backdropFilter: "blur(10px)",
    border: "1px solid var(--line)",
    color: "var(--text-muted)",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    boxShadow: "0 12px 28px var(--shadow)",
  },
  brand: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--text)",
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
    color: "var(--text-muted)",
    fontSize: 12,
  },
  navActive: {
    background: "var(--accent-soft)",
    color: "var(--text)",
  },
  note: {
    fontSize: 12,
    color: "var(--text-muted)",
  },
  footerMobile: {
    marginTop: 8,
    padding: "16px 14px",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
  },
  brandMobile: {
    textAlign: "center",
  },
  navMobile: {
    width: "100%",
    justifyContent: "center",
    gap: 8,
  },
  navItemMobile: {
    fontSize: 11,
    padding: "8px 10px",
    textAlign: "center",
  },
  noteMobile: {
    textAlign: "center",
  },
};
