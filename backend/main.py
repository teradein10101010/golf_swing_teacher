from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import tempfile
import uuid

from swing_analyzer import SwingAnalyzer

# =========================
# パス定義（★重要）
# =========================
BASE_DIR = Path(__file__).resolve().parent
VIDEOS_DIR = BASE_DIR / "videos"
VIDEOS_DIR.mkdir(exist_ok=True)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ★ StaticFiles は「実在するディレクトリ」だけを見る
app.mount("/videos", StaticFiles(directory=VIDEOS_DIR), name="videos")

analyzer = SwingAnalyzer()

@app.post("/api/analyze/single")
async def analyze_single(video: UploadFile = File(...)):
    print("=== ANALYZE CALLED ===")
    print("filename:", video.filename)

    # ① アップロード動画保存（/tmp でOK）
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(await video.read())
        src_path = tmp.name

    # ② 特徴量抽出
    df = analyzer.extract_metrics(src_path)

    # ③ HUD 動画生成（★ /app/videos に出す）
    hud_name = f"hud_{uuid.uuid4().hex}.mp4"
    hud_path = VIDEOS_DIR / hud_name

    print("HUD SAVE PATH:", hud_path)

    events, fps = analyzer.render_hud(
        src_path,
        df,
        str(hud_path)
    )

    # ★ デバッグ用（必ず一度確認）
    print("HUD EXISTS:", hud_path.exists(), hud_path)

    return {
        "fps": fps,
        "events": {
            "start": int(events["Start"]),
            "top": int(events["Top"]),
            "impact": int(events["Impact"]),
            "finish": int(events["Finish"]),
        },
        "video_url": f"/videos/{hud_name}"
    }
