from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool

from pathlib import Path
import tempfile
import uuid
import asyncio
import json
from typing import Dict, Any

from swing_analyzer import SwingAnalyzer

# =========================
# グローバル progress store
# =========================
progress_store: Dict[str, Dict[str, Any]] = {}

# =========================
# パス定義
# =========================
BASE_DIR = Path(__file__).resolve().parent
VIDEOS_DIR = BASE_DIR / "videos"
VIDEOS_DIR.mkdir(exist_ok=True)

# =========================
# FastAPI app
# =========================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/videos", StaticFiles(directory=VIDEOS_DIR), name="videos")

analyzer = SwingAnalyzer()


# =========================
# 単一動画解析 API
# =========================
@app.post("/api/analyze/single")
async def analyze_single(video: UploadFile = File(...)):
    job_id = uuid.uuid4().hex

    # ★ progress は必ず dict 構造
    progress_store[job_id] = {
        "status": "processing",
        "progress": 0,
    }

    # 一時ファイル保存
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(await video.read())
        src_path = tmp.name

    hud_name = f"hud_{job_id}.mp4"
    hud_path = VIDEOS_DIR / hud_name

    # =========================
    # 同期処理（threadpool行き）
    # =========================
    def sync_run():
        try:
            df = analyzer.extract_metrics(src_path)

            def progress_cb(p: int):
                progress_store[job_id]["progress"] = p

            events, fps = analyzer.render_hud(
                src_path,
                df,
                str(hud_path),
                progress_cb=progress_cb,
            )

            progress_store[job_id] = {
                "status": "done",
                "progress": 100,
                "result": {
                    "fps": fps,
                    "events": {
                        "start": int(events["Start"]),
                        "top": int(events["Top"]),
                        "impact": int(events["Impact"]),
                        "finish": int(events["Finish"]),
                    },
                    "video_url": f"/videos/{hud_name}",
                },
            }

        except Exception as e:
            progress_store[job_id] = {
                "status": "error",
                "progress": 0,
                "message": str(e),
            }

    # ★ event loop を止めない
    asyncio.create_task(run_in_threadpool(sync_run))

    return {"job_id": job_id}


# =========================
# progress 取得（SSE）
# =========================
@app.get("/api/analyze/progress/{job_id}")
async def analyze_progress(job_id: str):
    async def event_generator():
        while True:
            data = progress_store.get(job_id)

            if data is None:
                yield f"data: {json.dumps({'status':'not_found'})}\n\n"
                break

            yield f"data: {json.dumps(data)}\n\n"

            if data.get("status") in ("done", "error"):
                break

            await asyncio.sleep(0.2)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )
