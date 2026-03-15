import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import useIsMobile from "../hooks/useIsMobile";
import { trackEvent } from "../lib/analytics";
import { API_BASE } from "../lib/apiBase";

export default function Auth({ onUserChange }) {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEntitled, setIsEntitled] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [freeTrialRemaining, setFreeTrialRemaining] = useState(0);
  const [isFreeAccess, setIsFreeAccess] = useState(false);
  const [isEntitlementLoading, setIsEntitlementLoading] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      onUserChange?.(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      onUserChange?.(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setIsEntitled(false);
      setIsPaid(false);
      setFreeTrialRemaining(0);
      setIsFreeAccess(false);
      setIsEntitlementLoading(false);
      return;
    }

    let active = true;
    const run = async () => {
      setIsEntitlementLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          if (active) setIsEntitled(false);
          return;
        }
        const res = await fetch(`${API_BASE}/api/ai/entitlement`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await res.json();
        if (active) {
          setIsEntitled(Boolean(result.entitled));
          setIsPaid(Boolean(result.is_paid));
          setFreeTrialRemaining(Number(result.free_trial_remaining || 0));
          setIsFreeAccess(Boolean(result.free_access));
        }
      } catch (err) {
        console.error("fetchEntitlement failed", err);
        if (active) {
          setIsEntitled(false);
          setIsPaid(false);
          setFreeTrialRemaining(0);
          setIsFreeAccess(false);
        }
      } finally {
        if (active) {
          setIsEntitlementLoading(false);
        }
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [user]);

  const handleCancelSubscription = async () => {
    if (!user || !isEntitled || isCanceling) return;
    if (!window.confirm("サブスクリプションを解約します。よろしいですか？")) return;

    setIsCanceling(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        alert("ログインしてください");
        return;
      }
      const res = await fetch(`${API_BASE}/api/subscription/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.detail || "cancel failed");
      }
      setIsEntitled(false);
      setIsPaid(false);
      setIsFreeAccess(false);
      alert("サブスクリプションを解約しました");
    } catch (err) {
      console.error(err);
      alert("サブスクリプションの解約に失敗しました");
    } finally {
      setIsCanceling(false);
    }
  };

  const login = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      trackEvent("auth_error", { action: "login" });
      if (error.message === "Invalid login credentials") {
        alert("メールアドレスまたはパスワードが正しくありません");
      } else {
        alert("ログインに失敗しました。しばらくしてから再度お試しください");
      }
      return;
    }
    trackEvent("login", { method: "email" });
  };

  const signup = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      trackEvent("auth_error", { action: "signup" });
      alert(error.message);
    } else {
      trackEvent("sign_up", { method: "email" });
      alert("登録完了！ログインしてください");
    }
  };

  if (user) {
    return (
      <div style={{ ...styles.userBox, ...(isMobile ? styles.userBoxMobile : {}) }}>
        <div style={styles.accountMeta}>
          <span style={{ fontSize: 13 }}>{user.email}</span>
          <span
            style={{
              ...styles.statusBadge,
              ...(isEntitled ? styles.statusPaid : styles.statusFree),
            }}
          >
            {isEntitlementLoading
              ? "確認中"
              : isFreeAccess
              ? "無料開放中"
              : isPaid
              ? "課金中"
              : freeTrialRemaining > 0
              ? `無料残り${freeTrialRemaining}回`
              : "未課金"}
          </span>
        </div>
        {isPaid && !isFreeAccess && (
          <button
            style={{ ...styles.cancel, ...(isMobile ? styles.actionMobile : {}) }}
            onClick={handleCancelSubscription}
            disabled={isCanceling}
          >
            {isCanceling ? "解約中..." : "解約"}
          </button>
        )}
        <button
          style={{ ...styles.logout, ...(isMobile ? styles.actionMobile : {}) }}
          onClick={() => {
            trackEvent("logout");
            supabase.auth.signOut();
          }}
        >
          ログアウト
        </button>
      </div>
    );
  }

  return (
    <div style={{ ...styles.authBox, ...(isMobile ? styles.authBoxMobile : {}) }}>
      <input
        style={{ ...styles.input, ...(isMobile ? styles.inputMobile : {}) }}
        placeholder="メールアドレス"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        style={{ ...styles.input, ...(isMobile ? styles.inputMobile : {}) }}
        type="password"
        placeholder="パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        style={{
          ...styles.login,
          ...(isMobile ? styles.actionMobile : {}),
        }}
        onClick={login}
        disabled={loading}
      >
        🔐 ログイン
      </button>
      <button
        style={{
          ...styles.signup,
          ...(isMobile ? styles.actionMobile : {}),
        }}
        onClick={signup}
      >
        新規登録
      </button>
    </div>
  );
}

const styles = {
  authBox: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  input: {
    height: 36,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid var(--line)",
    background: "var(--surface)",
    color: "var(--text)",
    outline: "none",
  },
  login: {
    height: 36,
    padding: "0 16px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(135deg, var(--accent), var(--accent-strong))",
    color: "#fffaf1",
    fontWeight: 600,
    cursor: "pointer",
  },
  signup: {
    height: 36,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid var(--line)",
    background: "var(--surface-2)",
    color: "var(--text)",
    cursor: "pointer",
  },
  userBox: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  accountMeta: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  statusBadge: {
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid transparent",
  },
  statusPaid: {
    background: "rgba(181, 122, 74, 0.16)",
    borderColor: "rgba(181, 122, 74, 0.35)",
    color: "var(--text)",
  },
  statusFree: {
    background: "rgba(122, 106, 90, 0.12)",
    borderColor: "rgba(122, 106, 90, 0.3)",
    color: "var(--text-muted)",
  },
  cancel: {
    background: "var(--surface-2)",
    border: "1px solid var(--line)",
    color: "var(--text)",
    borderRadius: 10,
    padding: "6px 12px",
    cursor: "pointer",
  },
  logout: {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    color: "var(--text)",
    borderRadius: 10,
    padding: "6px 12px",
    cursor: "pointer",
  },
  authBoxMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    width: "100%",
  },
  inputMobile: {
    height: 40,
    width: "100%",
    boxSizing: "border-box",
  },
  actionMobile: {
    height: 40,
    width: "100%",
    boxSizing: "border-box",
    padding: "0 12px",
  },
  userBoxMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    width: "100%",
    gap: 8,
  },
};
