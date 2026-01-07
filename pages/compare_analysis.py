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

def render_video(r, st, video_name, event_time=0.0):
    # --- レスポンシブHTMLビデオ生成 ---
    video_base64 = base64.b64encode(r[video_name]).decode()

    video_html = f"""
    <div id="video-container" style="width:100%; background:black; line-height:0;">
      <video id="compare-video" controls playsinline style="width:100%; height:auto; max-height:90vh;">
        <source src="data:video/mp4;base64,{video_base64}" type="video/mp4">
      </video>
    </div>

    <script>
      const v = document.getElementById("compare-video");
      const container = document.getElementById("video-container");

      // Streamlitの親iframeに高さを伝える関数
      function sendHeight() {{
        const height = container.offsetHeight;
        window.parent.postMessage({{
          type: 'streamlit:setFrameHeight',
          height: height
        }}, '*');
      }}

      v.onloadedmetadata = function() {{
        v.currentTime = {event_time};
        sendHeight();
      }};

      // 窓サイズが変わった時に高さを再調整
      window.addEventListener('resize', sendHeight);

      // 定期的にチェック（念のため）
      setInterval(sendHeight, 1000);
    </script>
    """

    # st.videoの代わりにHTMLコンポーネントを使用
    # heightは初期値。JSが動けば自動で縮小・拡大されます
    with st.container(key=f"video_container_{video_name}"):
        st.components.v1.html(video_html, height=600, scrolling=False)

# =====================================================
# Streamlit UI
# =====================================================
st.set_page_config("Golf Swing Analyzer", layout="wide")
st.title("⛳ Golf Swing Analyzer")

if "step" not in st.session_state:
    st.session_state.step = "upload"

if "jump_time" not in st.session_state:
    st.session_state.jump_time = 0.0

if st.session_state.step == "upload":
    st.subheader("📤 動画アップロード")
    my_video = st.file_uploader("あなたのスイング動画", ["mp4", "mov"])
    pro_video = st.file_uploader("プロのスイング動画", ["mp4", "mov"])

    if st.button("解析開始"):
        if not my_video or not pro_video:
            st.error("両方の動画をアップロードしてください")
        else:
            st.session_state.my_video_bytes = my_video.read()
            st.session_state.pro_video_bytes = pro_video.read()
            st.session_state.step = "analyze"
            st.rerun()

elif st.session_state.step == "analyze":
    progress = st.progress(0)
    st.info("解析中…")

    analyzer = SwingAnalyzer()

    # -------------------------------
    # 一時ファイル保存
    # -------------------------------
    tmp = Path(tempfile.mkdtemp())
    my_path = tmp / "my.mp4"
    pro_path = tmp / "pro.mp4"

    my_path.write_bytes(st.session_state.my_video_bytes)
    pro_path.write_bytes(st.session_state.pro_video_bytes)
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

    event1, fps1 = analyzer.render_hud(
        str(my_path),
        df_my,
        str(my_hud_raw),
        progress=progress,
        base=0.3
    )

    event2, fps2 = analyzer.render_hud(
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
        event1["Start"],
        event2["Start"],
        str(compare_path)
    )

    progress.progress(1.0)

    st.session_state.result = {
        "my": load_bytes(my_hud),
        "pro": load_bytes(pro_hud),
        "compare": load_bytes(compare_path),
        "event1": event1,
        "event2": event2,
        "fps1": fps1,
        "fps2": fps2,
    }

    st.success("解析完了！")
    st.session_state.step = "result"
    st.rerun()

# =====================================================
# 結果表示
# =====================================================
elif st.session_state.step == "result":
    r = st.session_state.result

    # 1. 比較動画のセクション
    st.subheader("📊 比較解析")

    # --- ジャンプボタン ---
    # ※ s1, t1, im1, e1 などのイベント情報を session_state に保存しておく必要があります
    # ここでは例としてインパクト等へのボタンを配置
    cols = st.columns(4)
    if "jump_time_my" not in st.session_state:
        st.session_state.jump_time_my = 0.0
    if "jump_time_pro" not in st.session_state:
        st.session_state.jump_time_pro = 0.0

    render_video(r, st, "compare")

    st.download_button(
        "📥 比較動画をダウンロード",
        r["compare"],
        file_name="swing_comparison.mp4",
        mime="video/mp4"
    )

    st.divider()

    # 2. 個別動画のセクション
    c1, c2 = st.columns(2)
    with c1:
        st.subheader("あなたのスイング")
        # -------------------------------
        # ジャンプボタン（★追加）
        # -------------------------------
        cols = st.columns(4)
        for col, (label, frame) in zip(cols, r["event1"].items()):
            with col:
                if st.button(label, key=f"my_{label}"):
                    st.session_state.jump_time_my = frame / r["fps1"]

        st.caption(f"Jump to: {st.session_state.jump_time_my:.2f} sec")

        render_video(r, st, "my", st.session_state.jump_time_my)
    with c2:
        st.subheader("プロのスイング")

        # -------------------------------
        # ジャンプボタン（★追加）
        # -------------------------------
        cols = st.columns(4)
        for col, (label, frame) in zip(cols, r["event2"].items()):
            with col:
                if st.button(label, key=f"pro_{label}"):
                    st.session_state.jump_time_pro = frame / r["fps2"]

        st.caption(f"Jump to: {st.session_state.jump_time_pro:.2f} sec")

        render_video(r, st, "pro", st.session_state.jump_time_pro)


    st.divider()

    if st.button("🔁 最初からやり直す"):
        st.session_state.clear()
        st.rerun()