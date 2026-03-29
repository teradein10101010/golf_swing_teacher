import { LEGAL_INFO } from "../config/legal";

export default function Legal() {
  return (
    <div style={styles.page}>
      <h1 style={styles.title}>特定商取引法に基づく表記</h1>
      <p style={styles.lead}>
        有料プランや有料機能を提供する場合、以下の情報を表示する必要があります。
      </p>

      <section style={styles.section}>
        <h2 style={styles.heading}>販売事業者名</h2>
        <p style={styles.text}>{LEGAL_INFO.businessName}</p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>運営責任者</h2>
        <p style={styles.text}>{LEGAL_INFO.representative}</p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>所在地</h2>
        <p style={styles.text}>{LEGAL_INFO.address}</p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>問い合わせ先</h2>
        <p style={styles.text}>メールアドレス: {LEGAL_INFO.email}</p>
        <p style={styles.text}>受付時間: {LEGAL_INFO.hours}</p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>販売価格</h2>
        <p style={styles.text}>{LEGAL_INFO.price}</p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>商品代金以外の必要料金</h2>
        <p style={styles.text}>{LEGAL_INFO.extraFees}</p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>支払方法</h2>
        <p style={styles.text}>{LEGAL_INFO.paymentMethods}</p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>支払時期</h2>
        <p style={styles.text}>{LEGAL_INFO.paymentTiming}</p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>提供時期</h2>
        <p style={styles.text}>{LEGAL_INFO.deliveryTiming}</p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.heading}>解約・キャンセル</h2>
        <p style={styles.text}>{LEGAL_INFO.cancellationPolicy}</p>
        <p style={styles.text}>{LEGAL_INFO.refundPolicy}</p>
      </section>
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
};
