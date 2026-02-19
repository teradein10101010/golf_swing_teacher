import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import useIsMobile from "../hooks/useIsMobile";
import { trackEvent } from "../lib/analytics";

export default function Auth({ onUserChange }) {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
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
        <span style={{ fontSize: 13 }}>{user.email}</span>
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
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        style={{ ...styles.input, ...(isMobile ? styles.inputMobile : {}) }}
        type="password"
        placeholder="password"
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
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(0,0,0,0.3)",
    color: "#fff",
    outline: "none",
  },
  login: {
    height: 36,
    padding: "0 16px",
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(90deg,#22c55e,#16a34a)",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  signup: {
    height: 36,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "transparent",
    color: "#fff",
    cursor: "pointer",
  },
  userBox: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  logout: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "#fff",
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
