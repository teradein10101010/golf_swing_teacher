import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import SingleAnalysis from "./pages/SingleAnalysis";
import CompareAnalysis from "./pages/CompareAnalysis";
import Header from "./components/Header";

export default function App() {
  const [user, setUser] = useState(null);

  return (
    <BrowserRouter>
      {/* ===== Header（元のシンプル構成） ===== */}
      <Header user={user} onUserChange={setUser} />

      {/* ===== Main ===== */}
      <main style={styles.page}>
        <Routes>
          <Route path="/" element={<SingleAnalysis user={user} />} />
          <Route path="/compare" element={<CompareAnalysis user={user} />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg,#0f2027,#203a43,#2c5364)",
    color: "#fff",
    padding: 32,
    fontFamily: "system-ui",
  },
};
