import { useRef, useState } from "react";

const API_BASE = "http://localhost:8000";

function App() {
  const videoRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [originalVideoURL, setOriginalVideoURL] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  const [events, setEvents] = useState(null);
  const [fps, setFps] = useState(30);
  const [progress, setProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFileSelect = (file) => {
    if (!file) return;

    setSelectedFile(file);
    setOriginalVideoURL(URL.createObjectURL(file));
    setVideoURL(null);
    setEvents(null);
  };

  const handleAnalyze = async () => {
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
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = frame / fps;
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>🏌️ Golf Swing Analyzer</h1>
      <p style={styles.subtitle}>Upload your swing and analyze key moments</p>

      {/* Upload Card */}
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
            opacity: selectedFile ? 1 : 0.5,
          }}
        >
          解析する
        </button>
      </div>

      {isAnalyzing && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              height: 10,
              background: "#334155",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "linear-gradient(90deg,#22c55e,#16a34a)",
                transition: "width 0.2s ease",
              }}
            />
          </div>
          <p style={{ fontSize: 12, marginTop: 6, color: "#cbd5e1" }}>
            解析中… {progress}%
          </p>
        </div>
      )}

      {/* Result Card */}
      {videoURL && (
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>📊 解析結果</h3>

          <div style={styles.jumpButtons}>
            <JumpButton label="Start" onClick={() => jump(events.start)} />
            <JumpButton label="Top" onClick={() => jump(events.top)} />
            <JumpButton label="Impact" onClick={() => jump(events.impact)} />
            <JumpButton label="Finish" onClick={() => jump(events.finish)} />
          </div>

          <video ref={videoRef} src={videoURL} controls style={styles.video} />
        </div>
      )}
    </div>
  );
}

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
    background: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)",
    color: "#fff",
    padding: 32,
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
  },
  title: {
    textAlign: "center",
    fontSize: 36,
    marginBottom: 4,
  },
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
    boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 18,
  },
  fileLabel: {
    display: "inline-block",
    padding: "10px 16px",
    borderRadius: 10,
    background: "#1e293b",
    cursor: "pointer",
    marginBottom: 16,
  },
  primaryButton: {
    width: "100%",
    marginTop: 16,
    padding: "12px 0",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(90deg, #22c55e, #16a34a)",
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
    marginTop: 12,
    background: "#000",
  },
};

export default App;
