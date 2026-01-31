import { useRef, useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";

/* =====================
   環境変数（Vite）
===================== */
const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const API_BASE = import.meta.env.VITE_API_BASE;

if (!STRIPE_KEY) {
  console.error("Stripe Public Key is missing");
}

const stripePromise = loadStripe(STRIPE_KEY);

function App() {
  const videoRef = useRef(null);

  // ... (既存のStateはそのまま)
  const [selectedFile, setSelectedFile] = useState(null);
  const [originalVideoURL, setOriginalVideoURL] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  const [events, setEvents] = useState(null);
  const [fps, setFps] = useState(30);
  const [progress, setProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  // ★ 新規: 決済処理中のローディング
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  /* =====================
     ★ 新規: Stripeからの戻り処理 (初期化時)
  ===================== */
  useEffect(() => {
    // URLクエリパラメータを確認
    const query = new URLSearchParams(window.location.search);
    const sessionId = query.get("session_id");
    const videoPathParams = query.get("video_path"); // 復元用

    if (sessionId && videoPathParams) {
      // 支払い成功として戻ってきた場合
      setVideoURL(API_BASE + videoPathParams);
      // ここで本来はjob_id等を使ってeventsデータも再取得するのがベスト
      // 簡易的にAI解析を即実行する
      verifyPaymentAndRunAI(sessionId, videoPathParams);
    }
  }, []);

  const verifyPaymentAndRunAI = async (sessionId, videoPath) => {
    setAiLoading(true);
    // バックエンドで session_id を検証してから AIを実行
    const res = await fetch(`${API_BASE}/api/analyze/ai-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        video_path: videoPath,
      }),
    });

    const data = await res.json();
    if (data.advice) {
      setAiResult(data.advice);
      // URLを綺麗にする（オプション）
      window.history.replaceState(null, "", window.location.pathname);
    } else {
      alert("支払いの検証に失敗しました");
    }
    setAiLoading(false);
  };

  /* =====================
     ファイル選択・解析開始・ジャンプ
  ===================== */
  // ... (handleFileSelect, handleAnalyze, jump は既存のまま)
  const handleFileSelect = (file) => {
    if (!file) return;

    setSelectedFile(file);

    const localURL = URL.createObjectURL(file);
    setOriginalVideoURL(localURL);
    // 前回結果をリセット
    setVideoURL(null);
    setEvents(null);
    setAiResult(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setProgress(0);

    const form = new FormData();
    form.append("video", selectedFile);

    const res = await fetch(`${API_BASE}/api/analyze/single`, {
      method: "POST",
      body: form,
    });

    const { job_id } = await res.json();

    const es = new EventSource(`${API_BASE}/api/analyze/progress/${job_id}`);

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setProgress(data.progress);

      if (data.status === "done") {
        es.close();
        setIsAnalyzing(false);

        setVideoURL(API_BASE + data.result.video_url);
        setEvents(data.result.events);
        setFps(data.result.fps);
      }
    };
  };

  const jump = (frame) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = frame / fps;
  };

  /* =====================
     ★ 変更: AIコーチ (支払いフローへ)
  ===================== */
  const handlePurchaseAI = async () => {
    if (!videoURL) return;
    setIsCheckingOut(true);

    try {
      const stripe = await stripePromise;

      // 1. バックエンドでCheckout Sessionを作成
      const res = await fetch(`${API_BASE}/api/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // 戻ってきた時に動画を表示できるようにパスを送る
          video_path: videoURL.replace(API_BASE, ""),
        }),
      });

      const session = await res.json();

      // 2. Stripe決済画面へリダイレクト
      if (!session.url) {
        throw new Error("Checkout URL not returned from backend");
      }

      window.location.href = session.url;

      if (result.error) {
        alert(result.error.message);
      }
    } catch (err) {
      console.error(err);
      alert("決済の開始に失敗しました");
    } finally {
      setIsCheckingOut(false);
    }
  };

  /* =====================checkoutUrl
     Render
  ===================== */
  return (
    <div style={styles.page}>
      <h1 style={styles.title}>🏌️ Golf Swing Analyzer</h1>
      <p style={styles.subtitle}>Upload your swing and analyze key moments</p>

      {/* Upload */}
      <div style={styles.card}>
        <label style={styles.fileLabel}>
          動画を選択
          <input
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => handleFileSelect(e.target.files[0])}
          />
        </label>

        {originalVideoURL && (
          <>
            <h3 style={styles.sectionTitle}>🎥 元動画</h3>
            <video src={originalVideoURL} controls style={styles.video} />
          </>
        )}

        <button
          onClick={handleAnalyze}
          disabled={!selectedFile}
          style={{
            ...styles.primaryButton,
            background: selectedFile
              ? "linear-gradient(90deg,#22c55e,#16a34a)"
              : "#64748b",
            cursor: selectedFile ? "pointer" : "not-allowed",
          }}
        >
          解析する
        </button>
      </div>

      {/* Progress */}
      {isAnalyzing && (
        <div style={{ maxWidth: 520, margin: "0 auto 24px" }}>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${progress}%`,
              }}
            />
          </div>
          <p style={styles.progressText}>解析中… {progress}%</p>
        </div>
      )}

      {/* Result */}
      {/* ★ videoURLがあれば表示するように条件を少し緩和
          (リロード後はeventsがないかもしれないため、eventsがある場合のみボタンを出すなどの調整が必要)
      */}
      {videoURL && (
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>📊 解析結果</h3>

          {/* eventsがある場合のみジャンプボタン表示 */}
          {events && (
            <div style={styles.jumpButtons}>
              <JumpButton label="Start" onClick={() => jump(events.start)} />
              <JumpButton label="Top" onClick={() => jump(events.top)} />
              <JumpButton label="Impact" onClick={() => jump(events.impact)} />
              <JumpButton label="Finish" onClick={() => jump(events.finish)} />
            </div>
          )}

          <video ref={videoRef} src={videoURL} controls style={styles.video} />

          {/* 👇 有料化ボタンに変更 */}
          {!aiResult && (
            <button
              onClick={handlePurchaseAI}
              disabled={isCheckingOut || aiLoading}
              style={{
                ...styles.primaryButton,
                background: "linear-gradient(90deg, #6366f1, #4f46e5)", // Stripeっぽい色へ
              }}
            >
              {isCheckingOut
                ? "Stripeへ移動中..."
                : "💎 AIコーチのアドバイスを購入 (¥500)"}
            </button>
          )}

          {/* 解析中ローディング表示 */}
          {aiLoading && (
            <p style={{ textAlign: "center", marginTop: 10 }}>
              お支払い確認中... AIが解析しています...
            </p>
          )}

          {aiResult && (
            <div style={styles.aiBox}>
              <h4>🤖 AIコーチのアドバイス</h4>
              <p>{aiResult}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =====================
   Components
===================== */
const JumpButton = ({ label, onClick }) => (
  <button onClick={onClick} style={styles.jumpButton}>
    {label}
  </button>
);

/* =====================
   Styles
===================== */
const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg,#0f2027,#203a43,#2c5364)",
    color: "#fff",
    padding: 32,
    fontFamily: "system-ui",
  },
  title: { textAlign: "center", fontSize: 36 },
  subtitle: {
    textAlign: "center",
    color: "#cbd5e1",
    marginBottom: 32,
  },
  card: {
    background: "#0b1220",
    maxWidth: 520,
    margin: "0 auto 32px",
    padding: 24,
    borderRadius: 16,
  },
  sectionTitle: { marginBottom: 12 },
  fileLabel: {
    display: "inline-block",
    padding: "10px 16px",
    borderRadius: 10,
    background: "#1e293b",
    cursor: "pointer",
  },
  primaryButton: {
    width: "100%",
    marginTop: 16,
    padding: "12px 0",
    borderRadius: 12,
    border: "none",
    color: "#fff",
    fontSize: 16,
    cursor: "pointer",
  },
  jumpButtons: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  jumpButton: {
    padding: "6px 12px",
    borderRadius: 999,
    border: "none",
    background: "#334155",
    color: "#fff",
    cursor: "pointer",
  },
  video: {
    width: "100%",
    aspectRatio: "16 / 9",
    borderRadius: 12,
    background: "#000",
    marginTop: 12,
  },
  progressBar: {
    height: 10,
    background: "#334155",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg,#22c55e,#16a34a)",
    transition: "width 0.2s ease",
  },
  progressText: {
    fontSize: 12,
    marginTop: 6,
    color: "#cbd5e1",
  },
  aiBox: {
    marginTop: 20,
    background: "#020617",
    padding: 16,
    borderRadius: 12,
    whiteSpace: "pre-wrap",
  },
  payNote: {
    marginTop: 8,
    fontSize: 12,
    color: "#fbbf24",
    textAlign: "center",
  },
};

export default App;
