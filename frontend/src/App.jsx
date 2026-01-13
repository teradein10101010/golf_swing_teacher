import { useRef, useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function App() {
  const videoRef = useRef(null);

  const [videoFile, setVideoFile] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(false);

  // 動画選択
  const handleSelectVideo = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setVideoFile(file);
    setVideoURL(URL.createObjectURL(file));
    setEvents(null);
  };

  // 解析リクエスト
  const handleAnalyze = async () => {
    if (!videoFile) return;

    const formData = new FormData();
    formData.append("video", videoFile); // ← ★超重要

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/analyze/single`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const data = await res.json();
      setEvents(data.events);
    } catch (err) {
      console.error(err);
      alert("解析に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // フレームジャンプ
  const jumpToFrame = (frame) => {
    if (!videoRef.current) return;

    const fps = 30; // backend から返すなら置き換え
    videoRef.current.currentTime = frame / fps;
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h1>🏌️ Golf Swing Analyzer</h1>

      <input type="file" accept="video/*" onChange={handleSelectVideo} />

      {videoURL && (
        <div style={{ marginTop: 20 }}>
          <video
            ref={videoRef}
            src={videoURL}
            controls
            style={{ width: "100%", borderRadius: 8 }}
          />
        </div>
      )}

      {videoFile && (
        <button
          onClick={handleAnalyze}
          disabled={loading}
          style={{ marginTop: 16, padding: "8px 16px", fontSize: 16 }}
        >
          {loading ? "解析中..." : "スイング解析"}
        </button>
      )}

      {events && (
        <div style={{ marginTop: 24 }}>
          <h3>📍 スイング局面ジャンプ</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => jumpToFrame(events.start)}>Start</button>
            <button onClick={() => jumpToFrame(events.top)}>Top</button>
            <button onClick={() => jumpToFrame(events.impact)}>Impact</button>
            <button onClick={() => jumpToFrame(events.finish)}>Finish</button>
          </div>

          <pre style={{ marginTop: 16 }}>
            {JSON.stringify(events, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default App;
