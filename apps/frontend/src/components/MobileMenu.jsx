import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import useIsMobile from "../hooks/useIsMobile";

const MENU_LINKS = [
  { to: "/terms", label: "利用規約" },
  { to: "/privacy", label: "プライバシーポリシー" },
  { to: "/contact", label: "お問い合わせ" },
  { to: "/legal", label: "特定商取引法に基づく表記" },
];

export default function MobileMenu() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  if (!isMobile) return null;

  return (
    <>
      <button
        type="button"
        aria-label="メニューを開く"
        onClick={() => setOpen((v) => !v)}
        style={styles.button}
      >
        ☰
      </button>

      {open && (
        <>
          <div style={styles.backdrop} onClick={() => setOpen(false)} />
          <aside style={styles.sheet} aria-label="mobile-menu-sheet">
            <div style={styles.header}>
              <strong style={styles.title}>メニュー</strong>
              <button
                type="button"
                aria-label="メニューを閉じる"
                onClick={() => setOpen(false)}
                style={styles.closeButton}
              >
                ✕
              </button>
            </div>

            <nav style={styles.nav}>
              {MENU_LINKS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  style={{
                    ...styles.link,
                    ...(location.pathname === item.to ? styles.linkActive : {}),
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
        </>
      )}
    </>
  );
}

const styles = {
  button: {
    position: "fixed",
    top: "calc(env(safe-area-inset-top, 0px) + 12px)",
    right: 12,
    zIndex: 70,
    width: 42,
    height: 42,
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 12,
    background: "rgba(15, 23, 42, 0.88)",
    color: "#fff",
    backdropFilter: "blur(8px)",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(2, 6, 23, 0.56)",
    zIndex: 68,
  },
  sheet: {
    position: "fixed",
    right: 10,
    top: "calc(env(safe-area-inset-top, 0px) + 62px)",
    left: 10,
    zIndex: 69,
    background: "rgba(15, 23, 42, 0.97)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    color: "#e2e8f0",
  },
  closeButton: {
    width: 34,
    height: 34,
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 10,
    background: "transparent",
    color: "#cbd5e1",
    cursor: "pointer",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  link: {
    textDecoration: "none",
    color: "#cbd5e1",
    background: "rgba(30, 41, 59, 0.7)",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 600,
  },
  linkActive: {
    color: "#fff",
    background: "linear-gradient(135deg,#22c55e,#16a34a)",
  },
};
