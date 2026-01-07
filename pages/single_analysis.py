import streamlit as st
import tempfile
from pathlib import Path
import cv2
import numpy as np
import subprocess
import base64

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

# =====================================================
# Streamlit UI
# =====================================================
st.set_page_config("Golf Swing Analyzer", layout="wide")
st.title("⛳ Golf Swing Analyzer")

if "result" not in st.session_state:
    st.session_state.result = None

if "jump_time" not in st.session_state:
    st.session_state.jump_time = 0.0

my_video = st.file_uploader("あなたのスイング動画", ["mp4", "mov"])

if st.button("解析開始"):
    if not my_video:
        st.error("動画をアップロードしてください")
    else:
        progress = st.progress(0)
        st.info("解析中…")

        analyzer = SwingAnalyzer()

        # -------------------------------
        # 一時ファイル保存
        # -------------------------------
        tmp = Path(tempfile.mkdtemp())
        my_path = tmp / "my.mp4"

        my_path.write_bytes(my_video.read())
        progress.progress(0.05)

        # -------------------------------
        # ① 特徴量抽出
        # -------------------------------
        st.write("① スイングデータ解析中")
        df_my = analyzer.extract_metrics(str(my_path))
        progress.progress(0.3)

        # -------------------------------
        # ② HUD 動画生成（イベント反映）
        # -------------------------------
        st.write("② 動画生成中")
        my_hud_raw = tmp / "my_hud_raw.mp4"

        events, fps1 = analyzer.render_hud(
            str(my_path),
            df_my,
            str(my_hud_raw),
            progress=progress,
            base=0.3
        )
        my_hud = tmp / "my_hud.mp4"

        to_h264(my_hud_raw, my_hud)
        progress.progress(1.0)

        st.session_state.result = {
            "video_path": str(my_hud),
            "video_bytes": load_bytes(my_hud),
            "fps": fps1,
            "events": events
        }

        st.success("解析完了！")


# =====================================================
# 結果表示
# =====================================================
if st.session_state.result:
    r = st.session_state.result

    st.subheader("あなたのスイング")

    # -------------------------------
    # ジャンプボタン（★追加）
    # -------------------------------
    cols = st.columns(4)
    for col, (label, frame) in zip(cols, r["events"].items()):
        with col:
            if st.button(label):
                st.session_state.jump_time = frame / r["fps"]

    st.caption(f"Jump to: {st.session_state.jump_time:.2f} sec")

    # -------------------------------
    # HTML Video（レスポンシブ版）
    # -------------------------------
    video_base64 = base64.b64encode(r["video_bytes"]).decode()

    # 動画のメタデータ（幅・高さ）を取得してアスペクト比を計算
    # ※SwingAnalyzer側で元動画のw, hを取得している場合はそれを使ってください
    # ここでは一般的な16:9をデフォルトにしつつ、JSで動的に調整します

    video_html = f"""
    <div id="container" style="width:100%; max-width:100%; margin:auto; background:black; line-height:0;">
      <video id="video" controls playsinline style="width:100%; height:auto; max-height:80vh;">
        <source src="data:video/mp4;base64,{video_base64}" type="video/mp4">
      </video>
    </div>

    <script>
      const v = document.getElementById("video");
      const container = document.getElementById("container");

      // 1. 親iframeの高さをコンテンツに合わせる関数
      function updateHeight() {{
        const height = container.offsetHeight;
        window.parent.postMessage({{
          type: 'streamlit:setFrameHeight',
          height: height
        }}, '*');
      }}

      // 2. 動画の読み込み完了時にサイズ調整とシークを実行
      v.onloadedmetadata = function() {{
        v.currentTime = {st.session_state.jump_time};
        updateHeight();
      }};

      // ウィンドウサイズが変わったときも再計算
      window.addEventListener('resize', updateHeight);

      // 初期実行
      setTimeout(updateHeight, 500);
    </script>
    """

    # ポイント: 最初は少し大きめのheightを指定しておき、JSが実行されると最適化されます
    st.components.v1.html(video_html, height=800, scrolling=False)

    st.download_button(
        "📥 ダウンロード",
        r["video_bytes"],
        file_name="my_swing_hud.mp4",
        mime="video/mp4"
    )
