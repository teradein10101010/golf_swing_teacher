import { useRef, useState, useEffect } from "react";

const API_BASE = "http://localhost:8000";

function CompareAnalysis() {
  const videoARef = useRef(null);
  const videoBRef = useRef(null);

  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);

  // 元動画プレビュー用
  const [previewAURL, setPreviewAURL] = useState(null);
  const [previewBURL, setPreviewBURL] = useState(null);

  // 解析後動画
  const [videoAURL, setVideoAURL] = useState(null);
  const [videoBURL, setVideoBURL] = useState(null);

  const [eventsA, setEventsA] = useState(null);
  const [eventsB, setEventsB] = useState(null);

  const [fpsA, setFpsA] = useState(30);
  const [fpsB, setFpsB] = useState(30);

  const [progress, setProgress] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  /* =====================
     ファイル選択（即プレビュー）
  ===================== */
  const onSelectA = (file) => {
    if (!file) return;
    setFileA(file);
    setPreviewAURL(URL.createObjectURL(file));
    setVideoAURL(null);
    setEventsA(null);
  };

  const onSelectB = (file) => {
    if (!file) return;
    setFileB(file);
    setPreviewBURL(URL.createObjectURL(file));
    setVideoBURL(null);
    setEventsB(null);
  };

  /* =====================
     解析
  ===================== */
  const analyze = async () => {
    if (!fileA || !fileB) return;

    setIsAnalyzing(true);
    setProgress(0);

    const analyzeOne = async (file, onDone, offset) => {
      const form = new FormData();
      form.append("video", file);

      const res = await fetch(`${API_BASE}/api/analyze/single`, {
        method: "POST",
        body: form,
      });

      const { job_id } = await res.json();

      return new Promise((resolve) => {
        const es = new EventSource(
          `${API_BASE}/api/analyze/progress/${job_id}`,
        );

        es.onmessage = (e) => {
          const data = JSON.parse(e.data);

          setProgress((p) => Math.max(p, offset + data.progress * 0.5));

          if (data.status === "done") {
            es.close();
            onDone(data.result);
            resolve();
          }
        };
      });
    };

    await Promise.all([
      analyzeOne(
        fileA,
        (r) => {
          setVideoAURL(API_BASE + r.video_url);
          setEventsA(r.events);
          setFpsA(r.fps);
        },
        0,
      ),
      analyzeOne(
        fileB,
        (r) => {
          setVideoBURL(API_BASE + r.video_url);
          setEventsB(r.events);
          setFpsB(r.fps);
        },
        50,
      ),
    ]);

    setProgress(100);
    setIsAnalyzing(false);
  };

  /* =====================
     再生制御
  ===================== */
  const play = () => {
    videoARef.current?.play();
    videoBRef.current?.play();
    setIsPlaying(true);
  };

  const pause = () => {
    videoARef.current?.pause();
    videoBRef.current?.pause();
    setIsPlaying(false);
  };

  const togglePlay = () => {
    isPlaying ? pause() : play();
  };

  /* =====================
     同期ジャンプ（解析後のみ）
  ===================== */
  const jump = (key) => {
    if (!eventsA || !eventsB) return;

    videoARef.current.pause();
    videoARef.current.currentTime = eventsA[key] / fpsA;

    videoBRef.current.pause();
    videoBRef.current.currentTime = eventsB[key] / fpsB;
  };

  /* =====================
     表示に使う動画URL
     （解析後があればそちらを優先）
  ===================== */
  const currentAURL = videoAURL || previewAURL;
  const currentBURL = videoBURL || previewBURL;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>🏌️ Swing Compare Analysis</h1>
      <p style={styles.subtitle}>2つのスイングを同期して比較</p>

      {/* Upload */}
      <div style={styles.card}>
        <label style={styles.fileLabel}>
          動画Aを選択
          <input
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => onSelectA(e.target.files[0])}
          />
        </label>

        <label style={styles.fileLabel}>
          動画Bを選択
          <input
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => onSelectB(e.target.files[0])}
          />
        </label>

        <button
          onClick={analyze}
          disabled={!fileA || !fileB}
          style={{
            ...styles.primaryButton,
            opacity: fileA && fileB ? 1 : 0.5,
          }}
        >
          比較解析する
        </button>
      </div>

      {/* Progress */}
      {isAnalyzing && (
        <div style={{ maxWidth: 520, margin: "0 auto 32px" }}>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressInner,
                width: `${progress}%`,
              }}
            />
          </div>
          <p style={styles.progressText}>解析中… {progress}%</p>
        </div>
      )}

      {/* Jump buttons（解析後のみ） */}
      {eventsA && eventsB && (
        <div style={styles.jumpButtons}>
          <JumpButton label="Start" onClick={() => jump("start")} />
          <JumpButton label="Top" onClick={() => jump("top")} />
          <JumpButton label="Impact" onClick={() => jump("impact")} />
          <JumpButton label="Finish" onClick={() => jump("finish")} />
          <JumpButton
            label={isPlaying ? "Pause" : "Play"}
            onClick={togglePlay}
          />
        </div>
      )}

      {/* Videos（片方だけでも表示） */}
      {(currentAURL || currentBURL) && (
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={styles.videoGrid}>
            {currentAURL && (
              <video
                ref={videoARef}
                src={currentAURL}
                controls
                style={styles.video}
              />
            )}
            {currentBURL && (
              <video
                ref={videoBRef}
                src={currentBURL}
                controls
                style={styles.video}
              />
            )}
          </div>
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
  fileLabel: {
    display: "inline-block",
    padding: "10px 16px",
    borderRadius: 10,
    background: "#1e293b",
    cursor: "pointer",
    marginBottom: 16,
    marginRight: 8,
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
    justifyContent: "center",
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
    height: "auto",
    maxHeight: "70vh",
    borderRadius: 12,
    background: "#000",
    objectFit: "contain", // ← 重要
  },
  videoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  progressBar: {
    height: 10,
    background: "#334155",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressInner: {
    height: "100%",
    background: "linear-gradient(90deg,#22c55e,#16a34a)",
    transition: "width 0.2s ease",
  },
  progressText: {
    fontSize: 12,
    marginTop: 6,
    color: "#cbd5e1",
    textAlign: "center",
  },
};

export default CompareAnalysis;
