from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import cv2

from swing_analyzer import SwingAnalyzer

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

analyzer = SwingAnalyzer()

@app.post("/api/analyze/single")
async def analyze_single(video: UploadFile = File(...)):
    print("=== ANALYZE CALLED ===")
    print("filename:", video.filename)

    # ① 一時保存
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(await video.read())
        video_path = tmp.name

    # ② 特徴量抽出
    df = analyzer.extract_metrics(video_path)

    # ③ イベント検出
    start, top, impact, finish = analyzer.detect_events(df)

    # ④ fps 取得
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    cap.release()

    return {
        "fps": fps,
        "events": {
            "start": int(start),
            "top": int(top),
            "impact": int(impact),
            "finish": int(finish),
        },
        "frames": len(df),
    }
