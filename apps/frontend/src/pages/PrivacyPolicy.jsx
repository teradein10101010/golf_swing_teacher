export default function PrivacyPolicy() {
  return (
    <div style={styles.page}>
      <h1 style={styles.title}>プライバシーポリシー</h1>
      <p style={styles.lead}>
        Golf Swing
        Analyzer（以下「当サービス」）は、ユーザーの個人情報の取り扱いについて以下のとおり定めます。
      </p>

      <section style={styles.section}>
        <h2 style={styles.heading}>1. 取得する情報</h2>
        <p style={styles.text}>
          当サービスは、以下の情報を取得する場合があります。
        </p>
        <ul style={styles.list}>
          <li>氏名、メールアドレス等の連絡先情報</li>
          <li>ゴルフスイング動画や解析に必要なアップロードデータ</li>
          <li>アクセスログ、端末情報、Cookie等の利用状況データ</li>
        </ul>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>2. 利用目的</h2>
        <p style={styles.text}>取得した情報は、以下の目的で利用します。</p>
        <ul style={styles.list}>
          <li>スイング解析機能の提供、改善</li>
          <li>お問い合わせへの対応</li>
          <li>不正利用の防止・セキュリティ向上</li>
          <li>重要なお知らせの通知</li>
        </ul>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>3. 第三者提供</h2>
        <p style={styles.text}>
          法令に基づく場合を除き、本人の同意なく第三者に個人情報を提供することはありません。
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>4. 委託</h2>
        <p style={styles.text}>
          サービス提供のため、個人情報の取り扱いを業務委託先に委託する場合があります。委託先には適切な管理を求めます。
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>5. 保管期間</h2>
        <p style={styles.text}>
          利用目的の達成に必要な期間のみ情報を保管し、不要となった場合は適切な方法で削除します。
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>6. 開示・訂正・削除</h2>
        <p style={styles.text}>
          本人からの請求があった場合、法令に基づき適切に対応します。お問い合わせ先よりご連絡ください。
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>7. お問い合わせ先</h2>
        <p style={styles.text}>
          お問い合わせページのフォームよりご連絡ください。
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>8. 改定</h2>
        <p style={styles.text}>
          本ポリシーの内容は、必要に応じて改定することがあります。重要な変更は当サービス上で通知します。
        </p>
      </section>

      <p style={styles.date}>制定日: 2026年2月5日</p>
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
  date: { marginTop: 24, color: "#94a3b8", fontSize: 12 },
};
