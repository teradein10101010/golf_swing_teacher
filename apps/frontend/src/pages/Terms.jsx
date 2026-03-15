export default function Terms() {
  return (
    <div style={styles.page}>
      <h1 style={styles.title}>利用規約</h1>
      <p style={styles.lead}>
        この利用規約（以下「本規約」）は、ゴルフスイング解析（以下「当サービス」）の利用条件を定めるものです。
      </p>

      <section style={styles.section}>
        <h2 style={styles.heading}>1. 適用</h2>
        <p style={styles.text}>
          本規約は、当サービスの提供条件および当サービスの利用に関する当サービスとユーザーとの間の権利義務関係を定めます。
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>2. 利用登録</h2>
        <p style={styles.text}>
          ユーザーは、当サービスが定める方法で利用登録を行うことができます。当サービスは、登録申請を承認しない場合があります。
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>3. 禁止事項</h2>
        <p style={styles.text}>ユーザーは以下の行為を行ってはなりません。</p>
        <ul style={styles.list}>
          <li>法令または公序良俗に反する行為</li>
          <li>当サービスの運営を妨害する行為</li>
          <li>第三者の権利を侵害する行為</li>
          <li>不正アクセス、リバースエンジニアリング等</li>
        </ul>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>4. 知的財産権</h2>
        <p style={styles.text}>
          当サービスに関する知的財産権は当サービスまたは正当な権利者に帰属します。
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>5. 免責</h2>
        <p style={styles.text}>
          当サービスは、スイング解析結果の正確性や完全性について保証するものではありません。自己責任でご利用ください。
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>6. 利用停止・停止</h2>
        <p style={styles.text}>
          当サービスは、ユーザーが本規約に違反した場合などに、事前通知なく利用を停止することがあります。
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>7. 料金</h2>
        <p style={styles.text}>
          有料プランを提供する場合は、当サービス上に料金、支払方法、解約条件等を明示します。
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>8. 規約の変更</h2>
        <p style={styles.text}>
          当サービスは、本規約を必要に応じて改定できます。重要な変更は当サービス上で通知します。
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>9. 準拠法・裁判管轄</h2>
        <p style={styles.text}>
          本規約は日本法に準拠し、当サービスとユーザー間の紛争は当サービス所在地を管轄する裁判所を専属的合意管轄とします。
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
    background: "var(--surface)",
    borderRadius: 16,
    border: "1px solid var(--line)",
    boxShadow: "0 20px 40px var(--shadow)",
  },
  title: { fontSize: 28, fontWeight: 800, marginBottom: 12 },
  lead: { color: "var(--text)", marginBottom: 24, lineHeight: 1.7 },
  section: { marginBottom: 20 },
  heading: { fontSize: 18, fontWeight: 700, marginBottom: 8 },
  text: { color: "var(--text-muted)", lineHeight: 1.7 },
  list: { margin: "8px 0 0 18px", color: "var(--text-muted)", lineHeight: 1.7 },
  date: { marginTop: 24, color: "var(--text-muted)", fontSize: 12 },
};
