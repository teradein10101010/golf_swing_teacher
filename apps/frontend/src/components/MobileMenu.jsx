import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import useIsMobile from "../hooks/useIsMobile";

const MENU_LINKS = [
  { to: "/legal", label: "特商法表記" },
  { to: "/terms", label: "利用規約" },
  { to: "/privacy", label: "プライバシーポリシー" },
  { to: "/contact", label: "お問い合わせ" },
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
    border: "1px solid var(--line)",
    borderRadius: 12,
    background: "rgba(255, 250, 241, 0.92)",
    color: "var(--text)",
    backdropFilter: "blur(8px)",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(59, 43, 29, 0.18)",
    zIndex: 68,
  },
  sheet: {
    position: "fixed",
    right: 10,
    top: "calc(env(safe-area-inset-top, 0px) + 62px)",
    left: 10,
    zIndex: 69,
    background: "rgba(255, 250, 241, 0.96)",
    border: "1px solid var(--line)",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 14px 30px var(--shadow)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    color: "var(--text)",
  },
  closeButton: {
    width: 34,
    height: 34,
    border: "1px solid var(--line)",
    borderRadius: 10,
    background: "transparent",
    color: "var(--text-muted)",
    cursor: "pointer",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  link: {
    textDecoration: "none",
    color: "var(--text)",
    background: "var(--surface)",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 600,
    border: "1px solid var(--line)",
  },
  linkActive: {
    color: "var(--text)",
    background: "var(--accent-soft)",
    border: "1px solid rgba(181, 122, 74, 0.35)",
  },
};
