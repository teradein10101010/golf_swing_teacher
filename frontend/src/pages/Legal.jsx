export default function Legal() {
  return (
    <div style={styles.page}>
      <h1 style={styles.title}>特定商取引法に基づく表記</h1>
      <p style={styles.lead}>
        有料プランや有料機能を提供する場合、以下の情報を表示する必要があります。必要に応じて更新してください。
      </p>

      <section style={styles.section}>
        <h2 style={styles.heading}>販売事業者名</h2>
        <p style={styles.text}>（例）株式会社ゴルフスイング</p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>運営責任者</h2>
        <p style={styles.text}>（例）山田 太郎</p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>所在地</h2>
        <p style={styles.text}>（例）〒000-0000 東京都○○区○○1-2-3</p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>問い合わせ先</h2>
        <p style={styles.text}>メールアドレス: support@example.com</p>
        <p style={styles.text}>受付時間: 平日 10:00〜18:00（日本時間）</p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>販売価格</h2>
        <p style={styles.text}>各プランの購入ページに表示します。</p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>商品代金以外の必要料金</h2>
        <p style={styles.text}>
          インターネット接続料金等はユーザーの負担となります。
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>支払方法</h2>
        <p style={styles.text}>
          クレジットカード決済等（提供する支払方法に合わせて記載）。
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>支払時期</h2>
        <p style={styles.text}>各支払方法の規定に従います。</p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>提供時期</h2>
        <p style={styles.text}>決済完了後、直ちに利用可能です。</p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>返品・キャンセル</h2>
        <p style={styles.text}>
          デジタルサービスの特性上、購入後の返品・返金は原則できません。
        </p>
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
};
