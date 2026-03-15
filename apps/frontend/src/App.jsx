import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import SingleAnalysis from "./pages/SingleAnalysis";
import CompareAnalysis from "./pages/CompareAnalysis";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import Header from "./components/Header";
import Footer from "./components/Footer";
import MobileTabBar from "./components/MobileTabBar";
import MobileMenu from "./components/MobileMenu";
import useIsMobile from "./hooks/useIsMobile";
import { initAnalytics, trackPageView } from "./lib/analytics";
import { supabase } from "./lib/supabase";
import { API_BASE } from "./lib/apiBase";

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AppLayout />
    </BrowserRouter>
  );
}

function AppLayout() {
  const [user, setUser] = useState(null);
  const [serverFreeAccess, setServerFreeAccess] = useState(false);
  const [entitlementInfo, setEntitlementInfo] = useState({
    freeAccess: false,
    isPaid: false,
    freeTrialRemaining: 0,
  });
  const isMobile = useIsMobile();
  const location = useLocation();
  const showMobileTabBar = isMobile && ["/", "/compare"].includes(location.pathname);
  const showBetaNotice = ["/", "/compare"].includes(location.pathname) && serverFreeAccess;
  const showFreeTrialNotice =
    showBetaNotice &&
    user &&
    !entitlementInfo.freeAccess &&
    !entitlementInfo.isPaid &&
    entitlementInfo.freeTrialRemaining > 0;

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    trackPageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/ai/entitlement`);
        if (!res.ok) return;
        const result = await res.json();
        if (!active) return;
        setServerFreeAccess(Boolean(result.free_access));
      } catch (err) {
        console.error("fetch free access notice failed", err);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!user) {
        if (active) {
          setEntitlementInfo({
            freeAccess: false,
            isPaid: false,
            freeTrialRemaining: 0,
          });
        }
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          if (active) {
            setEntitlementInfo({
              freeAccess: false,
              isPaid: false,
              freeTrialRemaining: 0,
            });
          }
          return;
        }

        const res = await fetch(`${API_BASE}/api/ai/entitlement`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const result = await res.json();
        if (!active) return;
        setEntitlementInfo({
          freeAccess: Boolean(result.free_access),
          isPaid: Boolean(result.is_paid),
          freeTrialRemaining: Number(result.free_trial_remaining || 0),
        });
      } catch (err) {
        console.error("fetchEntitlement notice failed", err);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <div
      style={{
        ...styles.app,
        ...(isMobile ? styles.appMobile : {}),
      }}
      aria-label="app-layout"
    >
      {!isMobile && <Header user={user} onUserChange={setUser} />}

      <main
        style={{
          ...styles.page,
          ...(isMobile ? styles.pageMobile : {}),
          ...(showMobileTabBar ? styles.pageMobileTabSpace : {}),
        }}
      >
        {showBetaNotice && (
          <>
            <div style={{ ...styles.betaNotice, ...(isMobile ? styles.betaNoticeMobile : {}) }}>
              <strong>ベータ版のお知らせ:</strong> 現在は検証期間のためAI解析機能を無料で提供しています。
              正式版では有料プランを導入する予定です。
            </div>
            {showFreeTrialNotice && (
              <div style={{ ...styles.trialNotice, ...(isMobile ? styles.betaNoticeMobile : {}) }}>
                <strong>無料利用枠のお知らせ:</strong> 現在のアカウントではAI機能をあと
                {entitlementInfo.freeTrialRemaining}回無料で利用できます。無料枠の利用後は有料プランへの登録が必要です。
              </div>
            )}
          </>
        )}
        <Routes>
          <Route path="/" element={<SingleAnalysis user={user} />} />
          <Route path="/compare" element={<CompareAnalysis user={user} />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </main>

      {!showMobileTabBar && <Footer />}
      <MobileTabBar />
      <MobileMenu />
    </div>
  );
}

const styles = {
  app: {
    minHeight: "100vh",
    background: "transparent",
    color: "var(--text)",
    padding: 32,
    fontFamily: "inherit",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  page: {
    flex: 1,
  },
  appMobile: {
    padding: 14,
    gap: 14,
  },
  pageMobile: {
    minWidth: 0,
  },
  pageMobileTabSpace: {
    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 86px)",
  },
  betaNotice: {
    marginBottom: 16,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(181, 122, 74, 0.35)",
    background: "rgba(255, 245, 230, 0.92)",
    color: "var(--text)",
    fontSize: 14,
    lineHeight: 1.5,
    boxShadow: "0 8px 18px var(--shadow)",
  },
  betaNoticeMobile: {
    fontSize: 13,
    padding: "9px 12px",
    marginBottom: 12,
  },
  trialNotice: {
    marginBottom: 16,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(120, 90, 60, 0.35)",
    background: "rgba(255, 245, 230, 0.92)",
    color: "var(--text)",
    fontSize: 14,
    lineHeight: 1.5,
    boxShadow: "0 8px 18px var(--shadow)",
  },
};
