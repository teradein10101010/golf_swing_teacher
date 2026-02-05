import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import SingleAnalysis from "./pages/SingleAnalysis";
import CompareAnalysis from "./pages/CompareAnalysis";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import Contact from "./pages/Contact";
import Legal from "./pages/Legal";
import Header from "./components/Header";
import Footer from "./components/Footer";

export default function App() {
  const [user, setUser] = useState(null);

  return (
    <BrowserRouter>
      <div style={styles.app} aria-label="app-layout">
        {/* ===== Header（元のシンプル構成） ===== */}
        <Header user={user} onUserChange={setUser} />

        {/* ===== Main ===== */}
        <main style={styles.page}>
          <Routes>
            <Route path="/" element={<SingleAnalysis user={user} />} />
            <Route path="/compare" element={<CompareAnalysis user={user} />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/legal" element={<Legal />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </BrowserRouter>
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
};
