from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool

from dotenv import load_dotenv

from pathlib import Path
from pydantic import BaseModel
import tempfile
import uuid
import asyncio
import json
from typing import Dict, Any
import subprocess

from swing_analyzer import SwingAnalyzer

# =========================
# グローバル progress store
# =========================
load_dotenv()
progress_store: Dict[str, Dict[str, Any]] = {}

# =========================
# パス定義
# =========================
BASE_DIR = Path(__file__).resolve().parent
VIDEOS_DIR = BASE_DIR / "videos"
VIDEOS_DIR.mkdir(exist_ok=True)
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

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
app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")

analyzer = SwingAnalyzer()


def ffmpeg_to_cfr(
    input_path,
    output_path,
    fps=45,
    overwrite=True,
):
    """
    ffmpeg で動画を CFR（固定フレームレート）に変換する

    Parameters
    ----------
    input_path : str or Path
        入力動画
    output_path : str or Path
        出力動画
    fps : int or float
        固定フレームレート
    overwrite : bool
        Trueなら -y を付ける
    """

    input_path = str(input_path)
    output_path = str(output_path)

    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",  # ← 重要：エラーだけ表示
    ]

    if overwrite:
        cmd.append("-y")

    cmd += [
        "-i",
        input_path,
        "-vsync",
        "cfr",  # ★ 超重要
        "-r",
        str(fps),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        output_path,
    ]

    try:
        subprocess.run(
            cmd,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(
            "ffmpeg failed\n"
            f"command: {' '.join(cmd)}\n"
            f"stderr:\n{e.stderr.decode(errors='ignore')}"
        )


# =========================
# 単一動画解析 API
# =========================
@app.post("/api/analyze/single")
async def analyze_single(video: UploadFile = File(...)):
    job_id = uuid.uuid4().hex

    src_name = f"src_{job_id}.mp4"
    src_path = VIDEOS_DIR / src_name

    hud_name = f"hud_{job_id}.mp4"
    hud_path = VIDEOS_DIR / hud_name

    data_name = f"data_{job_id}.csv"
    data_path = DATA_DIR / data_name

    # ★ progress は必ず dict 構造
    progress_store[job_id] = {
        "status": "processing",
        "progress": 0,
    }

    # 一時ファイル保存
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(await video.read())
        input_path = tmp.name

    ffmpeg_to_cfr(
        input_path=input_path,
        output_path=src_path,
        fps=30,
    )

    # =========================
    # 同期処理（threadpool行き）
    # =========================
    def sync_run():
        try:
            df = analyzer.extract_metrics(src_path)
            df.to_csv(str(data_path))

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


# =====================================================
# ★ 比較スイング解析 API
# =====================================================
@app.post("/api/analyze/compare")
async def analyze_compare(left: UploadFile = File(...), right: UploadFile = File(...)):
    job_id = uuid.uuid4().hex
    progress_store[job_id] = {"status": "processing", "progress": 0}

    with tempfile.NamedTemporaryFile(
        delete=False, suffix=".mp4"
    ) as f1, tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as f2:
        f1.write(await left.read())
        f2.write(await right.read())
        left_path = f1.name
        right_path = f2.name

    async def run():
        # ① 特徴量抽出
        df_l = analyzer.extract_metrics(left_path)
        df_r = analyzer.extract_metrics(right_path)
        progress_store[job_id]["progress"] = 20

        # ② HUD 動画生成
        l_name = f"compare_left_{job_id}.mp4"
        r_name = f"compare_right_{job_id}.mp4"
        l_path = VIDEOS_DIR / l_name
        r_path = VIDEOS_DIR / r_name

        def cb(p):
            progress_store[job_id]["progress"] = 20 + int(p * 0.8)

        ev_l, fps_l = analyzer.render_hud(left_path, df_l, str(l_path), progress_cb=cb)
        ev_r, fps_r = analyzer.render_hud(right_path, df_r, str(r_path), progress_cb=cb)

        progress_store[job_id] = {
            "status": "done",
            "progress": 100,
            "result": {
                "left": {
                    "video_url": f"/videos/{l_name}",
                    "events": {k.lower(): int(v) for k, v in ev_l.items()},
                    "fps": fps_l,
                },
                "right": {
                    "video_url": f"/videos/{r_name}",
                    "events": {k.lower(): int(v) for k, v in ev_r.items()},
                    "fps": fps_r,
                },
            },
        }

    asyncio.create_task(run())
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


class AIRequest(BaseModel):
    video_path: str  # HUD動画のパス


@app.post("/api/analyze/ai")
def analyze_ai(req: AIRequest):
    video_path = VIDEOS_DIR / Path(req.video_path).name
    advice = analyzer.analyze_video(video_path)
    return {"advice": advice}
