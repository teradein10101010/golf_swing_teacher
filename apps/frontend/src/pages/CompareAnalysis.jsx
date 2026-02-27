import { useRef, useState, useEffect, useCallback } from "react";
import { supabase, FREE_ACCESS, SUPABASE_CONFIGURED } from "../lib/supabase";
import useIsMobile from "../hooks/useIsMobile";
import { trackEvent } from "../lib/analytics";
import { API_BASE } from "../lib/apiBase";
import { getAnonymousId } from "../lib/anonymousId";

const FREE_ACCESS_EFFECTIVE = FREE_ACCESS || !SUPABASE_CONFIGURED;
const MAX_AI_PROMPT_CHARS = 500;
const MAX_CHAT_MESSAGES = 12;
const AI_PROMPT_STORAGE_KEY = "compareAnalysis.aiPrompt";
const COMPARE_ANALYSIS_CACHE_KEY = "compareAnalysis.cache.v1";
const DEFAULT_AI_PROMPT = `以下の観点で2つのスイングを比較して教えてください。
1. それぞれの良い点
2. 主な違い（3つ）
3. それぞれに合った改善ドリル（各2つ）`;

const readCompareAnalysisCache = () => {
  try {
    const raw = window.sessionStorage.getItem(COMPARE_ANALYSIS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeCompareAnalysisCache = (value) => {
  try {
    window.sessionStorage.setItem(COMPARE_ANALYSIS_CACHE_KEY, JSON.stringify(value));
  } catch {
    // no-op
  }
};

const clearCompareAnalysisCache = () => {
  try {
    window.sessionStorage.removeItem(COMPARE_ANALYSIS_CACHE_KEY);
  } catch {
    // no-op
  }
};

function CompareAnalysis({ user }) {
  const videoARef = useRef(null);
  const videoBRef = useRef(null);
  const analyzeRequestInFlightRef = useRef(false);
  const aiRequestInFlightRef = useRef(false);
  const analyzeEventSourceARef = useRef(null);
  const analyzeEventSourceBRef = useRef(null);
  const progressARef = useRef(0);
  const progressBRef = useRef(0);
  const isMobile = useIsMobile();

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
  const [progressMessage, setProgressMessage] = useState("待機中");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [isEntitled, setIsEntitled] = useState(false);
  const [isEntitlementLoading, setIsEntitlementLoading] = useState(false);
  const [entitlementError, setEntitlementError] = useState(null);
  const [freeAccessServer, setFreeAccessServer] = useState(false);
  const [aiPrompt, setAiPrompt] = useState(() => {
    try {
      const saved = window.sessionStorage.getItem(AI_PROMPT_STORAGE_KEY);
      if (!saved) return DEFAULT_AI_PROMPT;
      return saved.slice(0, MAX_AI_PROMPT_CHARS);
    } catch {
      return DEFAULT_AI_PROMPT;
    }
  });

  const fetchEntitlement = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/entitlement`);
      if (res.ok) {
        const result = await res.json();
        if (result.free_access) {
          setFreeAccessServer(true);
          setIsEntitled(true);
          setIsEntitlementLoading(false);
          setEntitlementError(null);
          return;
        }
      }
    } catch {
      // ignore: fall back to env/user-based flow
    }

    if (FREE_ACCESS_EFFECTIVE || freeAccessServer) {
      setIsEntitled(true);
      setIsEntitlementLoading(false);
      setEntitlementError(null);
      return;
    }
    if (!user) {
      setIsEntitled(false);
      setIsEntitlementLoading(false);
      setEntitlementError(null);
      return;
    }

    setIsEntitlementLoading(true);
    setEntitlementError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setIsEntitled(false);
        return;
      }
      const res = await fetch(`${API_BASE}/api/ai/entitlement`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setIsEntitled(false);
        return;
      }
      const result = await res.json();
      setIsEntitled(Boolean(result.entitled));
      setFreeAccessServer(Boolean(result.free_access));
    } catch (err) {
      console.error("fetchEntitlement failed", err);
      setIsEntitled(false);
      setEntitlementError("ユーザ情報の確認に失敗しました");
    } finally {
      setIsEntitlementLoading(false);
    }
  }, [user, freeAccessServer]);

  useEffect(() => {
    fetchEntitlement();
  }, [fetchEntitlement]);

  const calcCompareProgress = (leftProgress, rightProgress) =>
    Math.max(leftProgress * 0.5, 50 + rightProgress * 0.5);

  const closeCompareEventSources = () => {
    if (analyzeEventSourceARef.current) {
      analyzeEventSourceARef.current.close();
      analyzeEventSourceARef.current = null;
    }
    if (analyzeEventSourceBRef.current) {
      analyzeEventSourceBRef.current.close();
      analyzeEventSourceBRef.current = null;
    }
  };

  const writeCompareProcessingCache = ({
    leftJobId,
    rightJobId,
    leftProgress = progressARef.current,
    rightProgress = progressBRef.current,
  }) => {
    writeCompareAnalysisCache({
      status: "processing",
      progress: calcCompareProgress(leftProgress, rightProgress),
      left: {
        jobId: leftJobId || null,
        progress: leftProgress,
        videoURL: videoAURL,
        events: eventsA,
        fps: fpsA,
      },
      right: {
        jobId: rightJobId || null,
        progress: rightProgress,
        videoURL: videoBURL,
        events: eventsB,
        fps: fpsB,
      },
    });
  };

  const connectCompareProgress = ({ side, jobId, onDone, accessToken, anonymousId }) =>
    new Promise((resolve, reject) => {
      const qs = new URLSearchParams();
      if (accessToken) qs.set("token", accessToken);
      if (!accessToken && anonymousId) qs.set("anonymous_id", anonymousId);
      const es = new EventSource(
        `${API_BASE}/api/analyze/progress/${jobId}?${qs.toString()}`,
      );
      if (side === "left") {
        if (analyzeEventSourceARef.current) analyzeEventSourceARef.current.close();
        analyzeEventSourceARef.current = es;
      } else {
        if (analyzeEventSourceBRef.current) analyzeEventSourceBRef.current.close();
        analyzeEventSourceBRef.current = es;
      }

      es.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.status === "not_found") {
          es.close();
          reject(new Error(`${side} analysis job not found`));
          return;
        }
        if (data.status === "error") {
          es.close();
          reject(new Error(data.message || `${side} analysis failed`));
          return;
        }

        if (typeof data.progress === "number") {
          if (side === "left") {
            progressARef.current = data.progress;
          } else {
            progressBRef.current = data.progress;
          }
          const combined = calcCompareProgress(progressARef.current, progressBRef.current);
          setProgress(combined);
          if (typeof data.message === "string" && data.message.trim()) {
            setProgressMessage(`${side === "left" ? "左" : "右"}: ${data.message}`);
          }
          writeCompareProcessingCache({
            leftJobId: side === "left" ? jobId : readCompareAnalysisCache()?.left?.jobId,
            rightJobId: side === "right" ? jobId : readCompareAnalysisCache()?.right?.jobId,
          });
        }

        if (data.status === "done") {
          es.close();
          onDone(data.result);
          const fullVideoURL = API_BASE + data.result.video_url;
          const cached = readCompareAnalysisCache() || {};
          const next = {
            ...cached,
            status: "processing",
            left:
              side === "left"
                ? {
                    ...(cached.left || {}),
                    jobId,
                    progress: 100,
                    videoURL: fullVideoURL,
                    events: data.result.events,
                    fps: data.result.fps,
                  }
                : cached.left,
            right:
              side === "right"
                ? {
                    ...(cached.right || {}),
                    jobId,
                    progress: 100,
                    videoURL: fullVideoURL,
                    events: data.result.events,
                    fps: data.result.fps,
                  }
                : cached.right,
          };
          if (side === "left") {
            progressARef.current = 100;
          } else {
            progressBRef.current = 100;
          }
          next.progress = calcCompareProgress(progressARef.current, progressBRef.current);
          writeCompareAnalysisCache(next);
          setProgress(next.progress);
          resolve(data.result);
        }
      };

      es.onerror = () => {
        es.close();
        reject(new Error(`${side} progress stream failed`));
      };
    });

  useEffect(() => {
    let cancelled = false;
    const reconnectWithToken = async (cached) => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const anonymousId = getAnonymousId();
      const reconnect = [];
      if (cached.left?.jobId && !cached.left?.videoURL) {
        reconnect.push(
          connectCompareProgress({
            side: "left",
            jobId: cached.left.jobId,
            accessToken,
            anonymousId,
            onDone: (r) => {
              setVideoAURL(API_BASE + r.video_url);
              setEventsA(r.events);
              setFpsA(r.fps);
            },
          }),
        );
      }
      if (cached.right?.jobId && !cached.right?.videoURL) {
        reconnect.push(
          connectCompareProgress({
            side: "right",
            jobId: cached.right.jobId,
            accessToken,
            anonymousId,
            onDone: (r) => {
              setVideoBURL(API_BASE + r.video_url);
              setEventsB(r.events);
              setFpsB(r.fps);
            },
          }),
        );
      }
      return Promise.all(reconnect)
        .then(() => {
          if (cancelled) return;
          const latest = readCompareAnalysisCache();
          if (latest?.left?.videoURL && latest?.right?.videoURL) {
            writeCompareAnalysisCache({
              ...latest,
              status: "done",
              progress: 100,
            });
          }
          setProgress(100);
          setIsAnalyzing(false);
          analyzeRequestInFlightRef.current = false;
        })
        .catch((err) => {
          if (cancelled) return;
          console.error(err);
          setProgressMessage("前回解析の復元に失敗しました");
          alert("前回の比較解析状態を復元できませんでした");
          clearCompareAnalysisCache();
          setIsAnalyzing(false);
          analyzeRequestInFlightRef.current = false;
        });
    };

    const cached = readCompareAnalysisCache();
    if (!cached) return;

    if (cached.left?.videoURL) {
      setVideoAURL(cached.left.videoURL);
      setEventsA(cached.left.events || null);
      setFpsA(cached.left.fps || 30);
    }
    if (cached.right?.videoURL) {
      setVideoBURL(cached.right.videoURL);
      setEventsB(cached.right.events || null);
      setFpsB(cached.right.fps || 30);
    }
    progressARef.current = cached.left?.progress || 0;
    progressBRef.current = cached.right?.progress || 0;
    setProgress(typeof cached.progress === "number" ? cached.progress : 0);

    if (
      cached.status === "processing" &&
      (cached.left?.jobId || cached.right?.jobId)
    ) {
      setIsAnalyzing(true);
      setProgressMessage("前回の比較解析を復元中");
      analyzeRequestInFlightRef.current = true;
      reconnectWithToken(cached);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      closeCompareEventSources();
    },
    [],
  );

  const buildNextMessages = () => {
    const content = aiPrompt.slice(0, MAX_AI_PROMPT_CHARS).trim();
    if (!content) return chatMessages;
    return [...chatMessages, { role: "user", content }].slice(-MAX_CHAT_MESSAGES);
  };

  const handleEntitledAI = async () => {
    if (!videoAURL || !videoBURL || !aiPrompt.trim() || aiRequestInFlightRef.current) return;
    trackEvent("ai_prompt_submitted", { mode: "compare", flow: "entitled" });
    aiRequestInFlightRef.current = true;
    setAiLoading(true);

    let token = null;
    let userMessageAdded = false;
    try {
      if (!FREE_ACCESS_EFFECTIVE && !freeAccessServer) {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token;
        if (!token) {
          alert("ログインしてください");
          return;
        }
      }

      const nextMessages = buildNextMessages();
      userMessageAdded = nextMessages.length > chatMessages.length;
      setChatMessages(nextMessages);
      if (userMessageAdded) {
        setAiPrompt("");
        try {
          window.sessionStorage.setItem(AI_PROMPT_STORAGE_KEY, "");
        } catch {
          // no-op
        }
      }

      const res = await fetch(`${API_BASE}/api/analyze/ai-compare-entitled`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "X-Anonymous-Id": getAnonymousId(),
        },
        body: JSON.stringify({
          left_video_path: videoAURL,
          right_video_path: videoBURL,
          ai_prompt: aiPrompt.slice(0, MAX_AI_PROMPT_CHARS).trim(),
          ai_messages: nextMessages,
        }),
      });
      const result = await res.json();
      if (result.advice) {
        trackEvent("ai_advice_received", { mode: "compare", flow: "entitled" });
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.advice,
          },
        ]);
      } else {
        trackEvent("ai_request_error", { mode: "compare", flow: "entitled" });
        alert("比較AIアドバイスの取得に失敗しました");
        if (userMessageAdded) {
          setChatMessages((prev) => prev.slice(0, -1));
        }
      }
    } catch (err) {
      console.error(err);
      trackEvent("ai_request_error", { mode: "compare", flow: "entitled" });
      alert("比較AIアドバイスの取得に失敗しました");
      if (userMessageAdded) {
        setChatMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      setAiLoading(false);
      aiRequestInFlightRef.current = false;
    }
  };

  const handleAiPromptChange = (e) => {
    const next = e.target.value.slice(0, MAX_AI_PROMPT_CHARS);
    setAiPrompt(next);
    try {
      window.sessionStorage.setItem(AI_PROMPT_STORAGE_KEY, next);
    } catch {
      // no-op
    }
  };

  /* =====================
     ファイル選択（即プレビュー）
  ===================== */
  const onSelectA = (file) => {
    if (!file) return;
    trackEvent("video_file_selected", {
      mode: "compare",
      side: "left",
      file_type: file.type || "unknown",
      file_size_mb: Number((file.size / (1024 * 1024)).toFixed(2)),
    });
    closeCompareEventSources();
    analyzeRequestInFlightRef.current = false;
    progressARef.current = 0;
    progressBRef.current = 0;
    clearCompareAnalysisCache();
    setFileA(file);
    setPreviewAURL(URL.createObjectURL(file));
    setVideoAURL(null);
    setEventsA(null);
    setProgress(0);
    setProgressMessage("待機中");
    setIsAnalyzing(false);
    setChatMessages([]);
  };

  const onSelectB = (file) => {
    if (!file) return;
    trackEvent("video_file_selected", {
      mode: "compare",
      side: "right",
      file_type: file.type || "unknown",
      file_size_mb: Number((file.size / (1024 * 1024)).toFixed(2)),
    });
    closeCompareEventSources();
    analyzeRequestInFlightRef.current = false;
    progressARef.current = 0;
    progressBRef.current = 0;
    clearCompareAnalysisCache();
    setFileB(file);
    setPreviewBURL(URL.createObjectURL(file));
    setVideoBURL(null);
    setEventsB(null);
    setProgress(0);
    setProgressMessage("待機中");
    setIsAnalyzing(false);
    setChatMessages([]);
  };

  /* =====================
     解析
  ===================== */
  const analyze = async () => {
    if (!fileA || !fileB || analyzeRequestInFlightRef.current) return;
    trackEvent("analysis_started", { mode: "compare" });
    analyzeRequestInFlightRef.current = true;
    closeCompareEventSources();

    setIsAnalyzing(true);
    setProgress(0);
    setProgressMessage("解析ジョブを作成中");
    setChatMessages([]);
    progressARef.current = 0;
    progressBRef.current = 0;
    clearCompareAnalysisCache();

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    const anonymousId = getAnonymousId();

    const createSingleJob = async (file) => {
      const form = new FormData();
      form.append("video", file);

      const res = await fetch(`${API_BASE}/api/analyze/single`, {
        method: "POST",
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          "X-Anonymous-Id": anonymousId,
        },
        body: form,
      });
      if (!res.ok) {
        throw new Error("analyze/single failed");
      }

      const { job_id } = await res.json();
      return job_id;
    };

    try {
      const [leftJobId, rightJobId] = await Promise.all([
        createSingleJob(fileA),
        createSingleJob(fileB),
      ]);
      setProgressMessage("比較解析を開始しました");
      writeCompareAnalysisCache({
        status: "processing",
        progress: 0,
        left: {
          jobId: leftJobId,
          progress: 0,
          videoURL: null,
          events: null,
          fps: 30,
        },
        right: {
          jobId: rightJobId,
          progress: 0,
          videoURL: null,
          events: null,
          fps: 30,
        },
      });

      await Promise.all([
        connectCompareProgress({
          side: "left",
          jobId: leftJobId,
          accessToken,
          anonymousId,
          onDone: (r) => {
            const fullURL = API_BASE + r.video_url;
            setVideoAURL(fullURL);
            setEventsA(r.events);
            setFpsA(r.fps);
          },
        }),
        connectCompareProgress({
          side: "right",
          jobId: rightJobId,
          accessToken,
          anonymousId,
          onDone: (r) => {
            const fullURL = API_BASE + r.video_url;
            setVideoBURL(fullURL);
            setEventsB(r.events);
            setFpsB(r.fps);
          },
        }),
      ]);

      setProgress(100);
      setProgressMessage("比較解析が完了しました");
      trackEvent("analysis_completed", { mode: "compare" });
      const latest = readCompareAnalysisCache();
      if (latest) {
        writeCompareAnalysisCache({
          ...latest,
          status: "done",
          progress: 100,
        });
      }
    } catch (err) {
      console.error(err);
      trackEvent("analysis_failed", { mode: "compare" });
      alert("比較解析に失敗しました");
      const cached = readCompareAnalysisCache();
      if (!cached?.left?.jobId && !cached?.right?.jobId) {
        clearCompareAnalysisCache();
      }
    } finally {
      setIsAnalyzing(false);
      analyzeRequestInFlightRef.current = false;
    }
  };

  /* =====================
     再生制御
  ===================== */
  const play = () => {
    videoARef.current?.play();
    videoBRef.current?.play();
    setIsPlaying(true);
    trackEvent("video_sync_play", { mode: "compare" });
  };

  const pause = () => {
    videoARef.current?.pause();
    videoBRef.current?.pause();
    setIsPlaying(false);
    trackEvent("video_sync_pause", { mode: "compare" });
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
    trackEvent("analysis_jump", { mode: "compare", point: key });
  };

  /* =====================
     表示に使う動画URL
     （解析後があればそちらを優先）
  ===================== */
  const currentAURL = videoAURL || previewAURL;
  const currentBURL = videoBURL || previewBURL;

  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <h1 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>
        🏌️ Swing Compare Analysis
      </h1>
      <p style={{ ...styles.subtitle, ...(isMobile ? styles.subtitleMobile : {}) }}>
        2つのスイングを同期して比較
      </p>

      {/* Upload */}
      <div style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
        <label style={{ ...styles.fileLabel, ...(isMobile ? styles.fileLabelMobile : {}) }}>
          動画Aを選択
          <input
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => onSelectA(e.target.files[0])}
          />
        </label>

        <label style={{ ...styles.fileLabel, ...(isMobile ? styles.fileLabelMobile : {}) }}>
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
          disabled={!fileA || !fileB || isAnalyzing}
          style={{
            ...styles.primaryButton,
            ...(isMobile ? styles.primaryButtonMobile : {}),
            opacity: fileA && fileB && !isAnalyzing ? 1 : 0.5,
          }}
        >
          比較解析する
        </button>
      </div>

      {/* Progress */}
      {isAnalyzing && (
        <div
          style={{
            maxWidth: 520,
            margin: "0 auto 32px",
            ...(isMobile ? styles.progressWrapMobile : {}),
          }}
        >
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressInner,
                width: `${progress}%`,
              }}
            />
          </div>
          <p style={{ ...styles.progressText, ...(isMobile ? styles.progressTextMobile : {}) }}>
            解析中… {progress}%
          </p>
          <p style={{ ...styles.progressText, opacity: 0.85 }}>{progressMessage}</p>
        </div>
      )}

      {/* Jump buttons（解析後のみ） */}
      {eventsA && eventsB && (
        <div style={{ ...styles.jumpButtons, ...(isMobile ? styles.jumpButtonsMobile : {}) }}>
          <JumpButton label="Start" onClick={() => jump("start")} isMobile={isMobile} />
          <JumpButton label="Top" onClick={() => jump("top")} isMobile={isMobile} />
          <JumpButton label="Impact" onClick={() => jump("impact")} isMobile={isMobile} />
          <JumpButton label="Finish" onClick={() => jump("finish")} isMobile={isMobile} />
          <JumpButton
            label={isPlaying ? "Pause" : "Play"}
            onClick={togglePlay}
            isMobile={isMobile}
          />
        </div>
      )}

      {/* Videos（片方だけでも表示） */}
      {(currentAURL || currentBURL) && (
        <div style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
          <div style={{ ...styles.videoGrid, ...(isMobile ? styles.videoGridMobile : {}) }}>
            {currentAURL && (
              <video
                ref={videoARef}
                src={currentAURL}
                controls
                playsInline
                style={{ ...styles.video, ...(isMobile ? styles.videoMobile : {}) }}
              />
            )}
            {currentBURL && (
              <video
                ref={videoBRef}
                src={currentBURL}
                controls
                playsInline
                style={{ ...styles.video, ...(isMobile ? styles.videoMobile : {}) }}
              />
            )}
          </div>

          {chatMessages.length > 0 || aiLoading ? (
            <div style={{ ...styles.aiBox, ...(isMobile ? styles.aiBoxMobile : {}) }}>
              <div style={styles.aiHeader}>
                <h4 style={{ ...styles.aiTitle, ...(isMobile ? styles.aiTitleMobile : {}) }}>
                  🤖 比較AIコーチ チャット
                </h4>
              </div>
              <div style={{ ...styles.aiContent, ...(isMobile ? styles.aiContentMobile : {}) }}>
                {chatMessages.map((msg, index) => (
                  <div
                    key={`${msg.role}-${index}`}
                    style={{
                      ...styles.chatBubble,
                      ...(msg.role === "user" ? styles.userBubble : styles.assistantBubble),
                    }}
                  >
                    <div style={styles.chatRole}>{msg.role === "user" ? "あなた" : "AIコーチ"}</div>
                    {msg.role === "assistant" ? (
                      renderAiAdvice(msg.content)
                    ) : (
                      <p style={styles.chatUserText}>{msg.content}</p>
                    )}
                  </div>
                ))}
                {aiLoading && (
                  <div style={{ ...styles.chatBubble, ...styles.assistantBubble }}>
                    <div style={styles.chatRole}>AIコーチ</div>
                    <p style={{ ...styles.chatUserText, ...styles.chatLoadingText }}>
                      AIが比較解析しています...
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {videoAURL && videoBURL && (
            <>
              <div style={styles.promptSection}>
                <label style={styles.promptLabel} htmlFor="compareAiPromptInput">
                  AIへの依頼内容（編集可能・最大500文字）
                </label>
                <textarea
                  id="compareAiPromptInput"
                  value={aiPrompt}
                  onChange={handleAiPromptChange}
                  maxLength={MAX_AI_PROMPT_CHARS}
                  style={{
                    ...styles.promptTextarea,
                    ...(isMobile ? styles.promptTextareaMobile : {}),
                  }}
                />
                <p style={styles.promptCounter}>
                  {aiPrompt.length}/{MAX_AI_PROMPT_CHARS}
                </p>
              </div>

              <button
                onClick={entitlementError ? fetchEntitlement : handleEntitledAI}
                disabled={
                  aiLoading ||
                  (!FREE_ACCESS_EFFECTIVE && !freeAccessServer && !user) ||
                  isEntitlementLoading ||
                  (!isEntitled && !FREE_ACCESS_EFFECTIVE && !freeAccessServer) ||
                  !aiPrompt.trim()
                }
                style={{
                  ...styles.primaryButton,
                  ...(isMobile ? styles.primaryButtonMobile : {}),
                  background: "linear-gradient(90deg, #6366f1, #4f46e5)",
                  cursor:
                    !user || isEntitlementLoading || entitlementError ? "not-allowed" : "pointer",
                }}
              >
                {!user && !FREE_ACCESS_EFFECTIVE && !freeAccessServer
                  ? "🔒 比較AIの利用にはログイン後にサブスク登録が必要です"
                  : entitlementError
                  ? "ユーザ確認に失敗しました（再試行）"
                  : isEntitlementLoading
                  ? "ユーザ確認中..."
                  : isEntitled || FREE_ACCESS_EFFECTIVE || freeAccessServer
                  ? FREE_ACCESS_EFFECTIVE || freeAccessServer
                    ? "🤖 比較AIコーチに送信（無料）"
                    : "🤖 比較AIコーチに送信"
                  : "🔒 比較AIの利用にはサブスク登録が必要です"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const renderInline = (text) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const content = part.slice(2, -2);
      return (
        <strong key={`b-${index}`} style={styles.aiStrong}>
          {content}
        </strong>
      );
    }
    return <span key={`t-${index}`}>{part}</span>;
  });
};

const renderAiAdvice = (text) => {
  const lines = text.split("\n");
  const elements = [];
  let listItems = [];

  const flushList = (keyBase) => {
    if (!listItems.length) return;
    elements.push(
      <ol key={`list-${keyBase}`} style={styles.aiList}>
        {listItems.map((item, index) => (
          <li key={`li-${keyBase}-${index}`} style={styles.aiListItem}>
            {renderInline(item)}
          </li>
        ))}
      </ol>,
    );
    listItems = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      flushList(index);
      elements.push(<div key={`sp-${index}`} style={styles.aiSpacer} />);
      return;
    }
    if (line === "---" || line === "—" || line === "***") {
      flushList(index);
      elements.push(<hr key={`hr-${index}`} style={styles.aiDivider} />);
      return;
    }
    if (line.startsWith("###")) {
      flushList(index);
      elements.push(
        <h5 key={`h-${index}`} style={styles.aiHeading}>
          {renderInline(line.replace(/^###\s*/, ""))}
        </h5>,
      );
      return;
    }
    const ordered = line.match(/^(\d+)[\.\)]\s+/);
    if (ordered) {
      listItems.push(line.replace(/^(\d+)[\.\)]\s+/, ""));
      return;
    }
    flushList(index);
    elements.push(
      <p key={`p-${index}`} style={styles.aiParagraph}>
        {renderInline(line)}
      </p>,
    );
  });

  flushList("end");
  return elements;
};

const JumpButton = ({ label, onClick, isMobile }) => (
  <button
    onClick={onClick}
    style={{ ...styles.jumpButton, ...(isMobile ? styles.jumpButtonMobile : {}) }}
  >
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
    objectFit: "contain",
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
  aiBox: {
    marginTop: 20,
    background: "linear-gradient(180deg,#0b1220 0%, #0a0f1c 100%)",
    padding: 18,
    borderRadius: 14,
    border: "1px solid #1f2937",
    boxShadow: "0 10px 30px rgba(2,6,23,0.35)",
  },
  aiHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  aiTitle: {
    margin: 0,
    fontSize: 18,
    letterSpacing: 0.2,
  },
  aiContent: {
    color: "#e2e8f0",
    fontSize: 15,
    lineHeight: 1.85,
    letterSpacing: 0.2,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  aiParagraph: {
    margin: "0 0 10px",
  },
  aiHeading: {
    margin: "6px 0 8px",
    fontSize: 16,
    color: "#f8fafc",
  },
  aiList: {
    margin: "0 0 10px 20px",
    padding: 0,
  },
  aiListItem: {
    marginBottom: 6,
  },
  aiDivider: {
    border: "none",
    borderTop: "1px solid #1f2937",
    margin: "12px 0",
  },
  aiSpacer: {
    height: 6,
  },
  aiStrong: {
    color: "#f8fafc",
  },
  promptSection: {
    marginTop: 14,
  },
  promptLabel: {
    display: "block",
    fontSize: 13,
    color: "#cbd5e1",
    marginBottom: 6,
  },
  promptTextarea: {
    width: "100%",
    minHeight: 120,
    boxSizing: "border-box",
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#e2e8f0",
    padding: 10,
    fontSize: 14,
    lineHeight: 1.5,
    resize: "vertical",
  },
  promptTextareaMobile: {
    minHeight: 110,
  },
  promptCounter: {
    marginTop: 6,
    marginBottom: 0,
    textAlign: "right",
    fontSize: 12,
    color: "#94a3b8",
  },
  chatBubble: {
    borderRadius: 12,
    padding: 10,
  },
  userBubble: {
    background: "#1d4ed8",
    borderTopRightRadius: 4,
    alignSelf: "flex-end",
    maxWidth: "90%",
  },
  assistantBubble: {
    background: "#0f172a",
    border: "1px solid #1f2937",
    borderTopLeftRadius: 4,
  },
  chatRole: {
    fontSize: 12,
    color: "#bfdbfe",
    marginBottom: 6,
    fontWeight: 600,
  },
  chatUserText: {
    margin: 0,
    whiteSpace: "pre-wrap",
  },
  chatLoadingText: {
    color: "#cbd5e1",
  },
  pageMobile: {
    minHeight: "auto",
    padding: "14px 0 8px",
  },
  titleMobile: {
    fontSize: 28,
    marginBottom: 6,
  },
  subtitleMobile: {
    fontSize: 14,
    marginBottom: 18,
  },
  cardMobile: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 14,
  },
  fileLabelMobile: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "center",
    marginRight: 0,
    marginBottom: 10,
    padding: "12px 16px",
  },
  primaryButtonMobile: {
    minHeight: 46,
    marginTop: 10,
  },
  progressWrapMobile: {
    marginBottom: 18,
    padding: "0 2px",
  },
  progressTextMobile: {
    marginTop: 8,
  },
  jumpButtonsMobile: {
    gap: 6,
    marginBottom: 10,
  },
  jumpButtonMobile: {
    flex: 1,
    minWidth: "30%",
    minHeight: 38,
    fontSize: 13,
  },
  videoGridMobile: {
    gridTemplateColumns: "1fr",
    gap: 10,
  },
  videoMobile: {
    maxHeight: "45vh",
    borderRadius: 10,
  },
  aiBoxMobile: {
    padding: 14,
    marginTop: 14,
  },
  aiTitleMobile: {
    fontSize: 16,
  },
  aiContentMobile: {
    fontSize: 14,
    lineHeight: 1.75,
  },
};

export default CompareAnalysis;
