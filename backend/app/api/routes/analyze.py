import asyncio
import json
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, File, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.config import DATA_DIR, VIDEOS_DIR
from app.core.progress import progress_store
from app.services.swing_analyzer import SwingAnalyzer
from app.utils.ffmpeg import ffmpeg_to_cfr

router = APIRouter(prefix="/api/analyze")

analyzer = SwingAnalyzer()


async def _save_upload_to_temp(upload: UploadFile) -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(await upload.read())
        return tmp.name


def _set_error(job_id: str, exc: Exception) -> None:
    progress_store[job_id] = {
        "status": "error",
        "progress": 0,
        "message": str(exc),
    }


@router.post("/single")
async def analyze_single(video: UploadFile = File(...)):
    job_id = uuid.uuid4().hex

    src_name = f"src_{job_id}.mp4"
    src_path = VIDEOS_DIR / src_name

    hud_name = f"hud_{job_id}.mp4"
    hud_path = VIDEOS_DIR / hud_name

    data_name = f"data_{job_id}.csv"
    data_path = DATA_DIR / data_name

    progress_store[job_id] = {
        "status": "processing",
        "progress": 0,
    }

    input_path = await _save_upload_to_temp(video)

    ffmpeg_to_cfr(
        input_path=input_path,
        output_path=src_path,
        fps=30,
    )

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
            _set_error(job_id, e)

    asyncio.create_task(run_in_threadpool(sync_run))
    return {"job_id": job_id}


@router.post("/compare")
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

    def sync_run():
        try:
            df_l = analyzer.extract_metrics(left_path)
            df_r = analyzer.extract_metrics(right_path)
            progress_store[job_id]["progress"] = 20

            l_name = f"compare_left_{job_id}.mp4"
            r_name = f"compare_right_{job_id}.mp4"
            l_path = VIDEOS_DIR / l_name
            r_path = VIDEOS_DIR / r_name

            def cb(p):
                progress_store[job_id]["progress"] = 20 + int(p * 0.8)

            ev_l, fps_l = analyzer.render_hud(
                left_path, df_l, str(l_path), progress_cb=cb
            )
            ev_r, fps_r = analyzer.render_hud(
                right_path, df_r, str(r_path), progress_cb=cb
            )

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
        except Exception as e:
            _set_error(job_id, e)

    asyncio.create_task(run_in_threadpool(sync_run))
    return {"job_id": job_id}


@router.get("/progress/{job_id}")
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
    video_path: str


@router.post("/ai")
def analyze_ai(req: AIRequest):
    video_path = VIDEOS_DIR / Path(req.video_path).name
    advice = analyzer.analyze_video(video_path)
    return {"advice": advice}
