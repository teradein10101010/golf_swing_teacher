import { useState } from "react";
import { API_BASE } from "../lib/apiBase";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: "", text: "" });

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: "", text: "" });

    if (!name.trim() || !email.trim() || !message.trim()) {
      setStatus({ type: "error", text: "必須項目を入力してください。" });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/contact/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "送信に失敗しました");
      }
      setStatus({
        type: "success",
        text: "お問い合わせを送信しました。確認後、順次返信します。",
      });
      setMessage("");
    } catch (err) {
      setStatus({
        type: "error",
        text: err?.message || "お問い合わせ送信に失敗しました。",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>お問い合わせ</h1>
      <p style={styles.lead}>
        当サービスに関するご質問・ご要望は、以下の窓口よりご連絡ください。
      </p>

      <section style={styles.section}>
        <h2 style={styles.heading}>お問い合わせフォーム</h2>
        <p style={styles.text}>
          お問い合わせは下記フォームから送信してください。
        </p>
        <p style={styles.text}>受付時間: 平日 10:00〜18:00（日本時間）</p>
        <form onSubmit={onSubmit} style={styles.form}>
          <label style={styles.label}>
            お名前
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              style={styles.input}
              placeholder="山田 太郎"
            />
          </label>
          <label style={styles.label}>
            返信先メールアドレス
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
              style={styles.input}
              placeholder="name@example.com"
            />
          </label>
          <label style={styles.label}>
            お問い合わせ内容
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              maxLength={3000}
              rows={7}
              style={styles.textarea}
              placeholder="お問い合わせ内容をご記入ください"
            />
          </label>
          <button type="submit" disabled={isSubmitting} style={styles.submitButton}>
            {isSubmitting ? "送信中..." : "送信する"}
          </button>
          {status.text && (
            <p
              style={{
                ...styles.status,
                ...(status.type === "success" ? styles.statusSuccess : styles.statusError),
              }}
            >
              {status.text}
            </p>
          )}
        </form>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>お問い合わせ内容の例</h2>
        <ul style={styles.list}>
          <li>解析結果の見方について</li>
          <li>不具合の報告</li>
          <li>機能追加のご要望</li>
        </ul>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>返信の目安</h2>
        <p style={styles.text}>原則として2営業日以内の返信を目指します。</p>
      </section>
    </div>
  );
}

const styles = {
  page: {
    maxWidth: 920,
    margin: "0 auto",
    padding: "24px 20px",
    background: "rgba(2, 6, 23, 0.45)",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
  },
  title: { fontSize: 28, fontWeight: 800, marginBottom: 12 },
  lead: { color: "#e2e8f0", marginBottom: 24, lineHeight: 1.7 },
  section: { marginBottom: 20 },
  heading: { fontSize: 18, fontWeight: 700, marginBottom: 8 },
  text: { color: "#cbd5e1", lineHeight: 1.7 },
  list: { margin: "8px 0 0 18px", color: "#cbd5e1", lineHeight: 1.7 },
  form: {
    marginTop: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: 600,
  },
  input: {
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15, 23, 42, 0.7)",
    color: "#f8fafc",
    padding: "10px 12px",
    fontSize: 14,
  },
  textarea: {
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15, 23, 42, 0.7)",
    color: "#f8fafc",
    padding: "10px 12px",
    fontSize: 14,
    resize: "vertical",
  },
  submitButton: {
    marginTop: 4,
    border: "none",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 14,
    fontWeight: 700,
    color: "#062018",
    background: "linear-gradient(135deg,#86efac,#22c55e)",
    cursor: "pointer",
  },
  status: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.6,
  },
  statusSuccess: {
    color: "#86efac",
  },
  statusError: {
    color: "#fda4af",
  },
};
