import { useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";

import SingleAnalysis from "./pages/SingleAnalysis";
import CompareAnalysis from "./pages/CompareAnalysis";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import Legal from "./pages/Legal";
import Header from "./components/Header";
import Footer from "./components/Footer";
import MobileTabBar from "./components/MobileTabBar";
import MobileMenu from "./components/MobileMenu";
import useIsMobile from "./hooks/useIsMobile";

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

function AppLayout() {
  const [user, setUser] = useState(null);
  const isMobile = useIsMobile();
  const location = useLocation();
  const showMobileTabBar = isMobile && ["/", "/compare"].includes(location.pathname);

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
        <Routes>
          <Route path="/" element={<SingleAnalysis user={user} />} />
          <Route path="/compare" element={<CompareAnalysis user={user} />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/legal" element={<Legal />} />
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
    background: "linear-gradient(135deg,#0f2027,#203a43,#2c5364)",
    color: "#fff",
    padding: 32,
    fontFamily: "system-ui",
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
};
