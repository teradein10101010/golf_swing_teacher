import { BrowserRouter, Routes, Route } from "react-router-dom";
import SingleAnalysis from "./pages/SingleAnalysis";
import CompareAnalysis from "./pages/CompareAnalysis";
import Header from "./components/Header";

export default function App() {
  return (
    <BrowserRouter>
      <Header />

      <Routes>
        <Route path="/" element={<SingleAnalysis />} />
        <Route path="/compare" element={<CompareAnalysis />} />
      </Routes>
    </BrowserRouter>
  );
}
