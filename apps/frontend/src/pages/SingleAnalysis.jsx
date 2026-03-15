import { useRef, useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import useIsMobile from "../hooks/useIsMobile";
import { trackEvent } from "../lib/analytics";
import { API_BASE } from "../lib/apiBase";
import { getAnonymousId } from "../lib/anonymousId";

/* =====================
   環境変数（Vite）
===================== */
import { FREE_ACCESS, SUPABASE_CONFIGURED } from "../lib/supabase";

const FREE_ACCESS_EFFECTIVE = FREE_ACCESS || !SUPABASE_CONFIGURED;
const MAX_AI_PROMPT_CHARS = 500;
const MAX_CHAT_MESSAGES = 12;
const AI_PROMPT_STORAGE_KEY = "singleAnalysis.aiPrompt";
const SINGLE_ANALYSIS_CACHE_KEY = "singleAnalysis.cache.v1";
const DEFAULT_AI_PROMPT = `以下の三点を教えてください。
1. このスイングの良い点
2. 改善すべきポイント（3つ）
3. それぞれに改善点に対する具体的な練習方法`;

const readSingleAnalysisCache = () => {
  try {
    const raw = window.sessionStorage.getItem(SINGLE_ANALYSIS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeSingleAnalysisCache = (value) => {
  try {
    window.sessionStorage.setItem(SINGLE_ANALYSIS_CACHE_KEY, JSON.stringify(value));
  } catch {
    // no-op
  }
};

const clearSingleAnalysisCache = () => {
  try {
    window.sessionStorage.removeItem(SINGLE_ANALYSIS_CACHE_KEY);
  } catch {
    // no-op
  }
};

const readSavedAiPrompt = () => {
  try {
    const saved = window.sessionStorage.getItem(AI_PROMPT_STORAGE_KEY);
    if (!saved || !saved.trim()) return DEFAULT_AI_PROMPT;
    return saved.slice(0, MAX_AI_PROMPT_CHARS);
  } catch {
    return DEFAULT_AI_PROMPT;
  }
};

function App({ user }) {
  const videoRef = useRef(null);
  const analyzeRequestInFlightRef = useRef(false);
  const aiRequestInFlightRef = useRef(false);
  const checkoutRequestInFlightRef = useRef(false);
  const analyzeEventSourceRef = useRef(null);
  const previewRequestIdRef = useRef(0);
  const isMobile = useIsMobile();

  // ... (既存のStateはそのまま)
  const [selectedFile, setSelectedFile] = useState(null);
  const [originalVideoURL, setOriginalVideoURL] = useState(null);
  const [videoURL, setVideoURL] = useState(null);
  const [events, setEvents] = useState(null);
  const [fps, setFps] = useState(30);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("待機中");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [isEntitled, setIsEntitled] = useState(false);
  const [isPaidEntitled, setIsPaidEntitled] = useState(false);
  const [freeTrialRemaining, setFreeTrialRemaining] = useState(0);
  const [isEntitlementLoading, setIsEntitlementLoading] = useState(false);
  const [entitlementError, setEntitlementError] = useState(null);
  const [freeAccessServer, setFreeAccessServer] = useState(false);
  const [isPreparingPreview, setIsPreparingPreview] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  // ★ 新規: 決済処理中のローディング
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [aiPrompt, setAiPrompt] = useState(readSavedAiPrompt);

  /* =====================
     ★ 新規: Stripeからの戻り処理 (初期化時)
  ===================== */
  useEffect(() => {
    // URLクエリパラメータを確認
    const query = new URLSearchParams(window.location.search);
    const sessionId = query.get("session_id");
    const videoPathParams = query.get("video_path"); // 復元用

    if (sessionId && videoPathParams) {
      if (!user && !FREE_ACCESS_EFFECTIVE) {
        alert("AIアドバイスの利用にはログインが必要です");
        return;
      }
      // 支払い成功として戻ってきた場合
      const restoredVideoUrl = /^https?:\/\//.test(videoPathParams)
        ? videoPathParams
        : API_BASE + videoPathParams;
      setVideoURL(restoredVideoUrl);
      // ここで本来はjob_id等を使ってeventsデータも再取得するのがベスト
      // 簡易的にAI解析を即実行する
      verifyPaymentAndRunAI(sessionId, videoPathParams);
    }
  }, [user, freeAccessServer]);

  const fetchEntitlement = useCallback(async () => {
    // Server truth: if backend is in free mode, it returns free_access without auth
    try {
      const res = await fetch(`${API_BASE}/api/ai/entitlement`);
      if (res.ok) {
        const result = await res.json();
        if (result.free_access) {
          setFreeAccessServer(true);
          setIsEntitled(true);
          setIsPaidEntitled(true);
          setFreeTrialRemaining(Number(result.free_trial_remaining || 0));
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
      setIsPaidEntitled(true);
      setIsEntitlementLoading(false);
      setEntitlementError(null);
      return;
    }
    if (!user) {
      setIsEntitled(false);
      setIsPaidEntitled(false);
      setFreeTrialRemaining(0);
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
        setIsPaidEntitled(false);
        setFreeTrialRemaining(0);
        return;
      }
      const res = await fetch(`${API_BASE}/api/ai/entitlement`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setIsEntitled(false);
        setIsPaidEntitled(false);
        setFreeTrialRemaining(0);
        return;
      }
      const result = await res.json();
      setIsEntitled(Boolean(result.entitled));
      setIsPaidEntitled(Boolean(result.is_paid));
      setFreeTrialRemaining(Number(result.free_trial_remaining || 0));
      setFreeAccessServer(Boolean(result.free_access));
    } catch (err) {
      console.error("fetchEntitlement failed", err);
      setIsEntitled(false);
      setIsPaidEntitled(false);
      setFreeTrialRemaining(0);
      setEntitlementError("ユーザ情報の確認に失敗しました");
    } finally {
      setIsEntitlementLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEntitlement();
  }, [fetchEntitlement]);

  const closeAnalyzeEventSource = () => {
    if (!analyzeEventSourceRef.current) return;
    analyzeEventSourceRef.current.close();
    analyzeEventSourceRef.current = null;
  };

  const connectAnalyzeProgress = ({ jobId, accessToken, anonymousId }) =>
    new Promise((resolve, reject) => {
      closeAnalyzeEventSource();
      const qs = new URLSearchParams();
      if (accessToken) qs.set("token", accessToken);
      if (!accessToken && anonymousId) qs.set("anonymous_id", anonymousId);
      const es = new EventSource(
        `${API_BASE}/api/analyze/progress/${jobId}?${qs.toString()}`,
      );
      analyzeEventSourceRef.current = es;

      es.onmessage = (e) => {
        const data = JSON.parse(e.data);

        if (data.status === "not_found") {
          closeAnalyzeEventSource();
          clearSingleAnalysisCache();
          setIsAnalyzing(false);
          analyzeRequestInFlightRef.current = false;
          reject(new Error("analysis job not found"));
          return;
        }

        if (typeof data.progress === "number") {
          setProgress(data.progress);
        }
        if (typeof data.message === "string" && data.message.trim()) {
          setProgressMessage(data.message);
        }

        if (data.status === "done") {
          closeAnalyzeEventSource();
          const sourceVideoURL = data.result.source_video_url
            ? API_BASE + data.result.source_video_url
            : null;
          if (sourceVideoURL) {
            setOriginalVideoURL(sourceVideoURL);
          }
          setVideoURL(API_BASE + data.result.video_url);
          setEvents(data.result.events);
          setFps(data.result.fps);
          setProgress(100);
          setProgressMessage("解析が完了しました");
          setIsAnalyzing(false);
          analyzeRequestInFlightRef.current = false;
          writeSingleAnalysisCache({
            status: "done",
            progress: 100,
            originalVideoURL: sourceVideoURL || originalVideoURL || null,
            videoURL: API_BASE + data.result.video_url,
            events: data.result.events,
            fps: data.result.fps,
          });
          resolve(data.result);
          return;
        }

        if (data.status === "error") {
          closeAnalyzeEventSource();
          clearSingleAnalysisCache();
          setIsAnalyzing(false);
          analyzeRequestInFlightRef.current = false;
          reject(new Error(data.message || "analysis failed"));
          return;
        }

        writeSingleAnalysisCache({
          status: "processing",
          jobId,
          progress: typeof data.progress === "number" ? data.progress : 0,
          originalVideoURL: originalVideoURL || null,
        });
      };

      es.onerror = () => {
        closeAnalyzeEventSource();
        reject(new Error("analyze/progress stream failed"));
      };
    });

  useEffect(() => {
    let cancelled = false;
    const restoreCachedJob = async () => {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const anonymousId = getAnonymousId();
      connectAnalyzeProgress({ jobId: cached.jobId, accessToken, anonymousId }).catch((err) => {
        if (cancelled) return;
        console.error(err);
        setProgressMessage("前回解析の復元に失敗しました");
        setIsAnalyzing(false);
        analyzeRequestInFlightRef.current = false;
        alert("前回の解析状態を復元できませんでした");
      });
    };

    const cached = readSingleAnalysisCache();
    if (!cached) return;

    if (cached.status === "done" && cached.videoURL) {
      setOriginalVideoURL(cached.originalVideoURL || null);
      setVideoURL(cached.videoURL);
      setEvents(cached.events || null);
      setFps(cached.fps || 30);
      setProgress(100);
      return;
    }

    if (cached.status === "processing" && cached.jobId) {
      if (cached.originalVideoURL) {
        setOriginalVideoURL(cached.originalVideoURL);
      }
      setIsAnalyzing(true);
      setProgress(typeof cached.progress === "number" ? cached.progress : 0);
      setProgressMessage("前回の解析を復元中");
      analyzeRequestInFlightRef.current = true;
      restoreCachedJob();
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      closeAnalyzeEventSource();
    },
    [],
  );

  const verifyPaymentAndRunAI = async (sessionId, videoPath) => {
    if (FREE_ACCESS_EFFECTIVE || freeAccessServer) {
      await handleEntitledAI();
      return;
    }
    if (aiRequestInFlightRef.current) return;
    aiRequestInFlightRef.current = true;
    setAiLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        alert("ログインしてください");
        return;
      }
      const nextMessages = buildNextMessages();
      const userMessageAdded = nextMessages.length > chatMessages.length;
      setChatMessages(nextMessages);
      if (userMessageAdded) {
        setAiPrompt("");
        try {
          window.sessionStorage.setItem(AI_PROMPT_STORAGE_KEY, "");
        } catch {
          // no-op
        }
      }
      // バックエンドで session_id を検証してから AIを実行
      const res = await fetch(`${API_BASE}/api/analyze/ai-paid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Anonymous-Id": getAnonymousId(),
        },
        body: JSON.stringify({
          session_id: sessionId,
          video_path: videoPath,
          ai_prompt: aiPrompt.slice(0, MAX_AI_PROMPT_CHARS).trim(),
          ai_messages: nextMessages,
        }),
      });

      const result = await res.json();
      if (result.advice) {
        trackEvent("ai_advice_received", { mode: "single", flow: "paid" });
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.advice,
          },
        ]);
        setIsEntitled(true);
        setIsPaidEntitled(true);
        setFreeTrialRemaining(0);
        // URLを綺麗にする（オプション）
        window.history.replaceState(null, "", window.location.pathname);
      } else {
        trackEvent("ai_request_error", { mode: "single", flow: "paid" });
        alert("支払いの検証に失敗しました");
        if (userMessageAdded) {
          setChatMessages((prev) => prev.slice(0, -1));
        }
      }
    } catch (err) {
      console.error(err);
      trackEvent("ai_request_error", { mode: "single", flow: "paid" });
      alert("支払いの検証に失敗しました");
    } finally {
      setAiLoading(false);
      aiRequestInFlightRef.current = false;
    }
  };

  const handleEntitledAI = async () => {
    if (!videoURL || !aiPrompt.trim() || aiRequestInFlightRef.current) return;
    trackEvent("ai_prompt_submitted", { mode: "single", flow: "entitled" });
    aiRequestInFlightRef.current = true;
    setAiLoading(true);
    let token = null;
    const promptToSend = aiPrompt.slice(0, MAX_AI_PROMPT_CHARS).trim();
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
      const userMessageAdded = nextMessages.length > chatMessages.length;
      setChatMessages(nextMessages);
      if (userMessageAdded) {
        setAiPrompt("");
        try {
          window.sessionStorage.setItem(AI_PROMPT_STORAGE_KEY, "");
        } catch {
          // no-op
        }
      }
      const res = await fetch(`${API_BASE}/api/analyze/ai-entitled`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "X-Anonymous-Id": getAnonymousId(),
        },
        body: JSON.stringify({
          video_path: videoURL,
          ai_prompt: promptToSend,
          ai_messages: nextMessages,
        }),
      });
      const result = await res.json();
      if (result.advice) {
        trackEvent("ai_advice_received", { mode: "single", flow: "entitled" });
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.advice,
          },
        ]);
        setFreeTrialRemaining(Number(result.free_trial_remaining || 0));
        if (!FREE_ACCESS_EFFECTIVE && !freeAccessServer && !isPaidEntitled) {
          setIsEntitled(Number(result.free_trial_remaining || 0) > 0);
        }
      } else {
        trackEvent("ai_request_error", { mode: "single", flow: "entitled" });
        alert("AIアドバイスの取得に失敗しました");
        if (userMessageAdded) {
          setChatMessages((prev) => prev.slice(0, -1));
          setAiPrompt(promptToSend);
          try {
            window.sessionStorage.setItem(AI_PROMPT_STORAGE_KEY, promptToSend);
          } catch {
            // no-op
          }
        }
      }
    } catch (err) {
      console.error(err);
      trackEvent("ai_request_error", { mode: "single", flow: "entitled" });
      alert("AIアドバイスの取得に失敗しました");
      setAiPrompt(promptToSend);
      try {
        window.sessionStorage.setItem(AI_PROMPT_STORAGE_KEY, promptToSend);
      } catch {
        // no-op
      }
    } finally {
      setAiLoading(false);
      aiRequestInFlightRef.current = false;
    }
  };

  /* =====================
     ファイル選択・解析開始・ジャンプ
  ===================== */
  // ... (handleFileSelect, handleAnalyze, jump は既存のまま)
  const handleFileSelect = (file) => {
    if (!file) return;
    trackEvent("video_file_selected", {
      mode: "single",
      file_type: file.type || "unknown",
      file_size_mb: Number((file.size / (1024 * 1024)).toFixed(2)),
    });

    closeAnalyzeEventSource();
    analyzeRequestInFlightRef.current = false;
    clearSingleAnalysisCache();
    setSelectedFile(file);
    setOriginalVideoURL(null);
    setIsPreparingPreview(true);
    setPreviewError(null);
    // 前回結果をリセット
    setVideoURL(null);
    setEvents(null);
    setProgress(0);
    setProgressMessage("待機中");
    setIsAnalyzing(false);
    setChatMessages([]);

    const requestId = previewRequestIdRef.current + 1;
    previewRequestIdRef.current = requestId;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        const anonymousId = getAnonymousId();
        const form = new FormData();
        form.append("video", file);

        const res = await fetch(`${API_BASE}/api/analyze/preview`, {
          method: "POST",
          headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            "X-Anonymous-Id": anonymousId,
          },
          body: form,
        });
        if (!res.ok) {
          throw new Error("preview conversion failed");
        }
        const result = await res.json();
        if (previewRequestIdRef.current !== requestId) return;
        setOriginalVideoURL(API_BASE + result.video_url);
        setPreviewError(null);
      } catch (err) {
        console.error(err);
        if (previewRequestIdRef.current !== requestId) return;
        setPreviewError("元動画の変換プレビューに失敗しました");
      } finally {
        if (previewRequestIdRef.current === requestId) {
          setIsPreparingPreview(false);
        }
      }
    })();
  };

  const handleAnalyze = async () => {
    if (!selectedFile || analyzeRequestInFlightRef.current) return;
    trackEvent("analysis_started", { mode: "single" });
    analyzeRequestInFlightRef.current = true;
    setIsAnalyzing(true);
    setProgress(0);
    setProgressMessage("解析ジョブを作成中");
    clearSingleAnalysisCache();
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const anonymousId = getAnonymousId();
      if (!accessToken) {
        // anonymous mode is allowed
      }
      const form = new FormData();
      form.append("video", selectedFile);

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
      setProgressMessage("解析を開始しました");
      writeSingleAnalysisCache({
        status: "processing",
        jobId: job_id,
        progress: 0,
        originalVideoURL: originalVideoURL || null,
      });
      await connectAnalyzeProgress({ jobId: job_id, accessToken, anonymousId });
      trackEvent("analysis_completed", { mode: "single" });
    } catch (err) {
      console.error(err);
      trackEvent("analysis_failed", { mode: "single" });
      alert("解析に失敗しました");
      if (!readSingleAnalysisCache()?.jobId) {
        clearSingleAnalysisCache();
        analyzeRequestInFlightRef.current = false;
        setIsAnalyzing(false);
      }
    } finally {
      if (!analyzeRequestInFlightRef.current) {
        setIsAnalyzing(false);
      }
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

  const buildNextMessages = () => {
    const content = aiPrompt.slice(0, MAX_AI_PROMPT_CHARS).trim();
    if (!content) return chatMessages;
    return [...chatMessages, { role: "user", content }].slice(-MAX_CHAT_MESSAGES);
  };

  const jump = (frame, point) => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = frame / fps;
    if (point) {
      trackEvent("analysis_jump", { mode: "single", point });
    }
  };

  /* =====================
     ★ 変更: AIコーチ (支払いフローへ)
  ===================== */
  const handlePurchaseAI = async () => {
    if (!videoURL || checkoutRequestInFlightRef.current) return;
    if (FREE_ACCESS_EFFECTIVE || freeAccessServer) {
      await handleEntitledAI();
      return;
    }
    if (!user) {
      alert("AIアドバイスの購入にはログインが必要です");
      return;
    }
    if (isEntitled) {
      await handleEntitledAI();
      return;
    }
    checkoutRequestInFlightRef.current = true;
    setIsCheckingOut(true);
    trackEvent("checkout_started", { product: "single_ai" });

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        alert("ログインしてください");
        return;
      }

      // 1. バックエンドでCheckout Sessionを作成
      const res = await fetch(`${API_BASE}/api/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Anonymous-Id": getAnonymousId(),
        },
        body: JSON.stringify({
          // 戻ってきた時に動画を表示できるようにパスを送る
          video_path: videoURL,
        }),
      });

      const session = await res.json();
      if (session.already_paid) {
        trackEvent("checkout_skipped_paid", { product: "single_ai" });
        setIsEntitled(true);
        await handleEntitledAI();
        return;
      }

      // 2. Stripe決済画面へリダイレクト
      if (!session.url) {
        throw new Error("Checkout URL not returned from backend");
      }

      trackEvent("checkout_redirected", { product: "single_ai" });
      window.location.href = session.url;
    } catch (err) {
      console.error(err);
      trackEvent("checkout_failed", { product: "single_ai" });
      alert("決済の開始に失敗しました");
    } finally {
      setIsCheckingOut(false);
      checkoutRequestInFlightRef.current = false;
    }
  };

  /* =====================checkoutUrl
     Render
  ===================== */
  return (
    <div style={{ ...styles.page, ...(isMobile ? styles.pageMobile : {}) }}>
      <h1 style={{ ...styles.title, ...(isMobile ? styles.titleMobile : {}) }}>
        🏌️ ゴルフスイング解析
      </h1>
      <p style={{ ...styles.subtitle, ...(isMobile ? styles.subtitleMobile : {}) }}>
        動画をアップロードして、ポイントをやさしく解説します
      </p>

      {/* Upload */}
      <div style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
        <label style={{ ...styles.fileLabel, ...(isMobile ? styles.fileLabelMobile : {}) }}>
          動画を選択
          <input
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => handleFileSelect(e.target.files[0])}
          />
        </label>

        {isPreparingPreview && (
          <div style={{ ...styles.previewStatus, ...(isMobile ? styles.previewStatusMobile : {}) }}>
            元動画プレビューを変換中...
          </div>
        )}

        {previewError && (
          <div style={{ ...styles.previewError, ...(isMobile ? styles.previewStatusMobile : {}) }}>
            {previewError}
          </div>
        )}

        {originalVideoURL && (
          <>
            <h3 style={{ ...styles.sectionTitle, ...(isMobile ? styles.sectionTitleMobile : {}) }}>
              📷 元動画
            </h3>
            <video
              src={originalVideoURL}
              controls
              playsInline
              style={{ ...styles.video, ...(isMobile ? styles.videoMobile : {}) }}
            />
          </>
        )}

        <button
          onClick={handleAnalyze}
          disabled={!selectedFile || isAnalyzing}
          style={{
            ...styles.primaryButton,
            ...(isMobile ? styles.primaryButtonMobile : {}),
            background:
              selectedFile && !isAnalyzing
                ? "linear-gradient(135deg, var(--accent), var(--accent-strong))"
                : "#d5c7b8",
            cursor: selectedFile && !isAnalyzing ? "pointer" : "not-allowed",
          }}
        >
          解析する
        </button>
      </div>

      {/* Progress */}
      {isAnalyzing && (
        <div
          style={{
            maxWidth: 520,
            margin: "0 auto 24px",
            ...(isMobile ? styles.progressWrapMobile : {}),
          }}
        >
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
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

      {/* Result */}
      {/* ★ videoURLがあれば表示するように条件を少し緩和
          (リロード後はeventsがないかもしれないため、eventsがある場合のみボタンを出すなどの調整が必要)
      */}
      {videoURL && (
        <div style={{ ...styles.card, ...(isMobile ? styles.cardMobile : {}) }}>
          <h3 style={{ ...styles.sectionTitle, ...(isMobile ? styles.sectionTitleMobile : {}) }}>
            📊 解析結果
          </h3>

          {/* eventsがある場合のみジャンプボタン表示 */}
          {events && (
            <div style={{ ...styles.jumpButtons, ...(isMobile ? styles.jumpButtonsMobile : {}) }}>
              <JumpButton
                label="Start"
                onClick={() => jump(events.start, "start")}
                isMobile={isMobile}
              />
              <JumpButton
                label="Top"
                onClick={() => jump(events.top, "top")}
                isMobile={isMobile}
              />
              <JumpButton
                label="Impact"
                onClick={() => jump(events.impact, "impact")}
                isMobile={isMobile}
              />
              <JumpButton
                label="Finish"
                onClick={() => jump(events.finish, "finish")}
                isMobile={isMobile}
              />
            </div>
          )}

          <video
            ref={videoRef}
            src={videoURL}
            controls
            playsInline
            style={{ ...styles.video, ...(isMobile ? styles.videoMobile : {}) }}
          />

          {chatMessages.length > 0 || aiLoading ? (
            <div style={{ ...styles.aiBox, ...(isMobile ? styles.aiBoxMobile : {}) }}>
              <div style={styles.aiHeader}>
                <h4 style={{ ...styles.aiTitle, ...(isMobile ? styles.aiTitleMobile : {}) }}>
                  🤖 AIコーチ チャット
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
                    <div style={styles.chatRole}>
                      {msg.role === "user" ? "あなた" : "AIコーチ"}
                    </div>
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
                      AIが解析しています...
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <div style={styles.promptSection}>
            <label style={styles.promptLabel} htmlFor="aiPromptInput">
              AIへの依頼内容（編集可能・最大500文字）
            </label>
            <textarea
              id="aiPromptInput"
              value={aiPrompt}
              onChange={handleAiPromptChange}
              maxLength={MAX_AI_PROMPT_CHARS}
              style={{ ...styles.promptTextarea, ...(isMobile ? styles.promptTextareaMobile : {}) }}
            />
            <p style={styles.promptCounter}>
              {aiPrompt.length}/{MAX_AI_PROMPT_CHARS}
            </p>
          </div>

          <button
            onClick={
              entitlementError
                ? fetchEntitlement
                : isEntitled
                ? handleEntitledAI
                : handlePurchaseAI
            }
            disabled={
              isCheckingOut ||
              aiLoading ||
              (!FREE_ACCESS_EFFECTIVE && !freeAccessServer && !user) ||
              isEntitlementLoading ||
              (!isEntitled && !FREE_ACCESS_EFFECTIVE && !freeAccessServer ? false : !aiPrompt.trim())
            }
            style={{
              ...styles.primaryButton,
              ...(isMobile ? styles.primaryButtonMobile : {}),
              background: "linear-gradient(135deg, var(--accent), var(--accent-strong))",
              cursor:
                !user || isEntitlementLoading || entitlementError
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {!user && !FREE_ACCESS_EFFECTIVE && !freeAccessServer
              ? "🔒 AIアドバイスの利用にはログイン後にサブスクリプションが必要です"
              : entitlementError
              ? "ユーザ確認に失敗しました（再試行）"
              : isEntitlementLoading
              ? "ユーザ確認中..."
              : isEntitled
              ? FREE_ACCESS_EFFECTIVE || freeAccessServer
                ? "🤖 AIコーチに送信（無料）"
                : !isPaidEntitled && freeTrialRemaining > 0
                ? `🤖 AIコーチに送信（無料残り${freeTrialRemaining}回）`
                : "🤖 AIコーチに送信"
              : isCheckingOut
              ? "Stripeへ移動中..."
              : "💎 AIコーチの月額サブスクに登録 (¥500/月)"}
          </button>

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

/* =====================
   Components
===================== */
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
    background: "transparent",
    color: "var(--text)",
    padding: 32,
    fontFamily: "inherit",
  },
  title: {
    textAlign: "center",
    fontSize: 36,
    color: "var(--text)",
    textShadow: "0 2px 10px rgba(255, 255, 255, 0.9)",
  },
  subtitle: {
    textAlign: "center",
    color: "var(--text-muted)",
    marginBottom: 32,
  },
  card: {
    background: "var(--surface)",
    color: "var(--text)",
    maxWidth: 520,
    margin: "0 auto 32px",
    padding: 24,
    borderRadius: 16,
    border: "1px solid var(--line)",
    boxShadow: "0 18px 36px var(--shadow)",
  },
  sectionTitle: { marginBottom: 12 },
  fileLabel: {
    display: "inline-block",
    padding: "10px 16px",
    borderRadius: 10,
    background: "var(--surface-2)",
    color: "var(--text)",
    border: "1px solid var(--line)",
    cursor: "pointer",
  },
  primaryButton: {
    width: "100%",
    marginTop: 16,
    padding: "12px 0",
    borderRadius: 12,
    border: "none",
    color: "#fffaf1",
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
    background: "var(--surface-2)",
    color: "var(--text)",
    cursor: "pointer",
    border: "1px solid var(--line)",
  },
  jumpButtonMobile: {
    flex: 1,
    minWidth: "40%",
    minHeight: 38,
    fontSize: 13,
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
    background: "rgba(181, 122, 74, 0.2)",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "linear-gradient(90deg, var(--accent), var(--accent-strong))",
    transition: "width 0.2s ease",
  },
  progressText: {
    fontSize: 12,
    marginTop: 6,
    color: "var(--text-muted)",
  },
  aiBox: {
    marginTop: 20,
    background: "var(--surface)",
    padding: 18,
    borderRadius: 14,
    border: "1px solid var(--line)",
    boxShadow: "0 16px 32px var(--shadow)",
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
    color: "var(--text)",
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
    color: "var(--text)",
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
    borderTop: "1px solid var(--line)",
    margin: "12px 0",
  },
  aiSpacer: {
    height: 6,
  },
  aiStrong: {
    color: "var(--text)",
  },
  promptSection: {
    marginTop: 14,
  },
  promptLabel: {
    display: "block",
    fontSize: 13,
    color: "var(--text-muted)",
    marginBottom: 6,
  },
  promptTextarea: {
    width: "100%",
    minHeight: 120,
    boxSizing: "border-box",
    borderRadius: 10,
    border: "1px solid var(--line)",
    background: "var(--surface)",
    color: "var(--text)",
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
    color: "var(--text-muted)",
  },
  chatBubble: {
    borderRadius: 12,
    padding: 10,
  },
  userBubble: {
    background: "rgba(181, 122, 74, 0.2)",
    borderTopRightRadius: 4,
    alignSelf: "flex-end",
    maxWidth: "90%",
  },
  assistantBubble: {
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    borderTopLeftRadius: 4,
  },
  chatRole: {
    fontSize: 12,
    color: "var(--text-muted)",
    marginBottom: 6,
    fontWeight: 600,
  },
  chatUserText: {
    margin: 0,
    whiteSpace: "pre-wrap",
  },
  chatLoadingText: {
    color: "var(--text-muted)",
  },
  payNote: {
    marginTop: 8,
    fontSize: 12,
    color: "var(--accent)",
    textAlign: "center",
  },
  pageMobile: {
    minHeight: "auto",
    padding: "14px 0 8px",
  },
  titleMobile: {
    fontSize: 28,
    marginBottom: 4,
  },
  subtitleMobile: {
    fontSize: 14,
    marginBottom: 18,
    padding: "0 4px",
  },
  cardMobile: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
  },
  sectionTitleMobile: {
    marginTop: 4,
    marginBottom: 10,
    fontSize: 16,
  },
  fileLabelMobile: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "center",
    padding: "12px 16px",
  },
  primaryButtonMobile: {
    minHeight: 46,
    fontSize: 15,
  },
  jumpButtonsMobile: {
    gap: 6,
  },
  videoMobile: {
    marginTop: 10,
    borderRadius: 10,
  },
  previewStatus: {
    marginTop: 16,
    marginBottom: 12,
    padding: "14px 16px",
    borderRadius: 12,
    background: "rgba(181, 122, 74, 0.12)",
    color: "var(--text)",
    textAlign: "center",
  },
  previewError: {
    marginTop: 16,
    marginBottom: 12,
    padding: "14px 16px",
    borderRadius: 12,
    background: "rgba(220, 100, 80, 0.12)",
    color: "#7a2e24",
    textAlign: "center",
  },
  previewStatusMobile: {
    fontSize: 14,
  },
  progressWrapMobile: {
    marginBottom: 16,
    padding: "0 2px",
  },
  progressTextMobile: {
    textAlign: "center",
    marginTop: 8,
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

export default App;
