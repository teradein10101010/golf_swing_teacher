# app.py
import streamlit as st

st.set_page_config(
    page_title="Golf Swing Teacher",
    layout="wide"
)

# ============================
# ホーム画面
# ============================
st.title("🏌️‍♂️ Golf Swing Teacher")

st.markdown("""
AIを使ってゴルフスイングを **解析・比較** できるアプリです。
まずは単体解析から試してみてください。
""")

st.divider()

# ============================
# ページ遷移ボタン
# ============================
col1, col2 = st.columns(2)

with col1:
    st.subheader("🧍‍♂️ 単体スイング解析")
    st.write("""
    - 1つのスイング動画を解析
    - 局面（Start / Top / Impact / Finish）を自動検出
    - 骨格と数値でフォームを可視化
    """)
    if st.button("▶ 単体解析を始める", key="go_single"):
        st.switch_page("pages/single_analysis.py")

with col2:
    st.subheader("🆚 スイング比較解析（有料）")
    st.write("""
    - 2つのスイングを左右で比較
    - 同じ局面同士を自動で揃える
    - 数値差分を確認
    """)
    if st.button("▶ 比較解析を始める", key="go_compare"):
        st.switch_page("pages/compare_analysis.py")

st.divider()

st.success("⬅ サイドバーから直接ページを開くこともできます")
