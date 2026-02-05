export default function Contact() {
  return (
    <div style={styles.page}>
      <h1 style={styles.title}>お問い合わせ</h1>
      <p style={styles.lead}>
        当サービスに関するご質問・ご要望は、以下の窓口よりご連絡ください。
      </p>

      <section style={styles.section}>
        <h2 style={styles.heading}>連絡先</h2>
        <p style={styles.text}>
          メールアドレス: support@example.com（実運用時に差し替えてください）
        </p>
        <p style={styles.text}>受付時間: 平日 10:00〜18:00（日本時間）</p>
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
};
