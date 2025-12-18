import streamlit as st
import tempfile
from pathlib import Path
import cv2
import numpy as np
import subprocess

from swing_analyzer import SwingAnalyzer


# =====================================================
# Utility
# =====================================================
def load_bytes(path):
    with open(path, "rb") as f:
        return f.read()

def to_h264(src: Path, dst: Path):
    subprocess.run([
        "ffmpeg", "-y",
        "-i", str(src),
        "-vcodec", "libx264",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        str(dst)
    ], check=True)

def render_side_by_side(v1, v2, s1, s2, out):
    cap1 = cv2.VideoCapture(v1)
    cap2 = cv2.VideoCapture(v2)

    if not cap1.isOpened() or not cap2.isOpened():
        raise RuntimeError("Failed to open input videos")

    cap1.set(cv2.CAP_PROP_POS_FRAMES, max(0, s1 - 10))
    cap2.set(cv2.CAP_PROP_POS_FRAMES, max(0, s2 - 10))

    w1, h1 = int(cap1.get(3)), int(cap1.get(4))
    w2, h2 = int(cap2.get(3)), int(cap2.get(4))
    fps = cap1.get(cv2.CAP_PROP_FPS) or 30

    tmp_out = out + ".tmp.mp4"

    outv = cv2.VideoWriter(
        tmp_out,
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps,
        (w1 + w2, max(h1, h2))
    )

    if not outv.isOpened():
        raise RuntimeError("VideoWriter failed")

    while True:
        r1, f1 = cap1.read()
        r2, f2 = cap2.read()
        if not r1 or not r2:
            break

        f1 = cv2.resize(f1, (w1, max(h1, h2)))
        f2 = cv2.resize(f2, (w2, max(h1, h2)))
        outv.write(np.hstack([f1, f2]))

    cap1.release()
    cap2.release()
    outv.release()

    # ffmpeg で H.264 に変換
    import subprocess
    subprocess.run([
        "ffmpeg", "-y",
        "-i", tmp_out,
        "-vcodec", "libx264",
        "-pix_fmt", "yuv420p",
        out
    ], check=True)

# =====================================================
# Streamlit UI
# =====================================================
st.set_page_config("Golf Swing Analyzer", layout="wide")
st.title("⛳ Golf Swing Analyzer")

if "result" not in st.session_state:
    st.session_state.result = None

my_video = st.file_uploader("あなたのスイング動画", ["mp4", "mov"])
pro_video = st.file_uploader("プロのスイング動画", ["mp4", "mov"])

if st.button("解析開始"):
    if not my_video or not pro_video:
        st.error("両方の動画をアップロードしてください")
    else:
        progress = st.progress(0)
        st.info("解析中…")

        analyzer = SwingAnalyzer()

        # -------------------------------
        # 一時ファイル保存
        # -------------------------------
        tmp = Path(tempfile.mkdtemp())
        my_path = tmp / "my.mp4"
        pro_path = tmp / "pro.mp4"

        my_path.write_bytes(my_video.read())
        pro_path.write_bytes(pro_video.read())
        progress.progress(0.05)

        # -------------------------------
        # ① 特徴量抽出
        # -------------------------------
        st.write("① スイングデータ解析中")
        df_my = analyzer.extract_metrics(str(my_path))
        df_pro = analyzer.extract_metrics(str(pro_path))
        progress.progress(0.3)

        # -------------------------------
        # ② HUD 動画生成（イベント反映）
        # -------------------------------
        st.write("② 単体スイング動画生成中")
        my_hud_raw = tmp / "my_hud_raw.mp4"
        pro_hud_raw = tmp / "pro_hud_raw.mp4"

        s1, t1, im1, e1 = analyzer.render_hud(
            str(my_path),
            df_my,
            str(my_hud_raw),
            progress=progress,
            base=0.3
        )

        s2, t2, im2, e2 = analyzer.render_hud(
            str(pro_path),
            df_pro,
            str(pro_hud_raw),
            progress=progress,
            base=0.6
        )

        my_hud = tmp / "my_hud.mp4"
        pro_hud = tmp / "pro_hud.mp4"

        to_h264(my_hud_raw, my_hud)
        to_h264(pro_hud_raw, pro_hud)

        # -------------------------------
        # ③ 比較動画（impact 同期）
        # -------------------------------
        st.write("③ 比較動画生成中")
        compare_path = tmp / "compare.mp4"
        render_side_by_side(
            str(my_hud),
            str(pro_hud),
            s1,
            s2,
            str(compare_path)
        )

        progress.progress(1.0)

        st.session_state.result = {
            "my": load_bytes(my_hud),
            "pro": load_bytes(pro_hud),
            "compare": load_bytes(compare_path),
        }

        st.success("解析完了！")


# =====================================================
# 結果表示
# =====================================================
if st.session_state.result:
    r = st.session_state.result

    c1, c2 = st.columns(2)
    with c1:
        st.subheader("あなたのスイング（HUD）")
        st.video(r["my"], width=420)
        st.download_button(
            "📥 ダウンロード（あなたの動画）",
            r["my"],
            file_name="my_swing_hud.mp4",
            mime="video/mp4"
        )

    with c2:
        st.subheader("参考スイング（HUD）")
        st.video(r["pro"], width=420)
        st.download_button(
            "📥 ダウンロード（参考動画）",
            r["pro"],
            file_name="pro_swing_hud.mp4",
            mime="video/mp4"
        )

    st.subheader("比較動画")
    st.video(r["compare"], width=900)
    st.download_button(
        "📥 ダウンロード（比較動画）",
        r["compare"],
        file_name="swing_compare_side_by_side.mp4",
        mime="video/mp4"
    )