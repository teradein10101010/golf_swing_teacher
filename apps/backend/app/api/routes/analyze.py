import asyncio
import json
import logging
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse

from app.core.actor import (
    actor_key_for_anonymous,
    actor_key_for_user,
    get_anonymous_id_from_request,
    normalize_anonymous_id,
)
from app.core.auth import get_current_user_if_present, verify_access_token
from app.core.config import DATA_DIR, VIDEOS_DIR
from app.core.media_access import issue_media_token, register_asset_owner
from app.core.progress import progress_store
from app.core.rate_limit import enforce_rate_limit
from app.services.swing_analyzer import SwingAnalyzer
from app.utils.ffmpeg import ffmpeg_to_cfr

router = APIRouter(prefix="/api/analyze")

analyzer = SwingAnalyzer()
logger = logging.getLogger(__name__)
job_owner: dict[str, str] = {}
MAX_UPLOAD_BYTES = 200 * 1024 * 1024
ALLOWED_VIDEO_TYPES = {
    "video/mp4",
    "video/quicktime",
    "video/x-m4v",
    "application/octet-stream",
}


async def _save_upload_to_temp(upload: UploadFile) -> str:
    if upload.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported video format")
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            tmp_path = tmp.name
            total_size = 0
            while True:
                chunk = await upload.read(1024 * 1024)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Video file is too large")
                tmp.write(chunk)
            return tmp.name
    except Exception:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)
        raise


def _set_error(job_id: str, exc: Exception) -> None:
    logger.exception("Analyze job failed (job_id=%s): %s", job_id, exc)
    progress_store[job_id] = {
        "status": "error",
        "progress": 0,
        "message": "解析中にエラーが発生しました",
    }


def _set_progress(job_id: str, progress: int, message: str) -> None:
    state = progress_store.get(job_id) or {"status": "processing"}
    state["status"] = "processing"
    state["progress"] = progress
    state["message"] = message
    progress_store[job_id] = state


def _make_media_video_url(filename: str) -> str:
    token = issue_media_token(filename=filename, media_kind="video")
    return f"/api/media/videos/{filename}?token={token}"


def _sanitize_progress_payload(data: dict) -> dict:
    return {k: v for k, v in data.items() if not k.startswith("_")}


def _extract_bearer_token(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    token = auth[7:].strip()
    return token or None


def _resolve_actor(request: Request, user: dict | None) -> tuple[str, str]:
    if user and user.get("sub"):
        user_id = str(user["sub"])
        return actor_key_for_user(user_id), user_id

    anonymous_id = get_anonymous_id_from_request(request)
    if not anonymous_id:
        raise HTTPException(status_code=401, detail="Authentication or anonymous id required")
    return actor_key_for_anonymous(anonymous_id), f"anon:{anonymous_id}"


def _resolve_progress_actor(request: Request, token: str | None, anonymous_id: str | None) -> str:
    bearer = _extract_bearer_token(request)
    if bearer:
        user = verify_access_token(bearer)
        return actor_key_for_user(str(user["sub"]))
    if token:
        user = verify_access_token(token)
        return actor_key_for_user(str(user["sub"]))
    normalized_anon = normalize_anonymous_id(anonymous_id)
    if normalized_anon:
        return actor_key_for_anonymous(normalized_anon)
    raise HTTPException(status_code=401, detail="Authentication or anonymous id required")


@router.post("/single")
async def analyze_single(
    request: Request,
    video: UploadFile = File(...),
    user=Depends(get_current_user_if_present),
):
    actor_key, rate_limiter_actor = _resolve_actor(request, user)
    enforce_rate_limit(
        key=f"analyze:single:{rate_limiter_actor}:{request.client.host if request.client else 'unknown'}",
        limit=6,
        window_seconds=60,
    )
    job_id = uuid.uuid4().hex
    job_owner[job_id] = actor_key

    src_name = f"src_{job_id}.mp4"
    src_path = VIDEOS_DIR / src_name

    hud_name = f"hud_{job_id}.mp4"
    hud_path = VIDEOS_DIR / hud_name

    data_name = f"data_{job_id}.csv"
    data_path = DATA_DIR / data_name

    progress_store[job_id] = {
        "status": "processing",
        "progress": 0,
        "message": "アップロードを準備中",
    }

    input_path = await _save_upload_to_temp(video)
    _set_progress(job_id, 3, "解析ジョブを開始しました")

    def sync_run():
        try:
            _set_progress(job_id, 8, "動画形式を最適化中")
            ffmpeg_to_cfr(
                input_path=input_path,
                output_path=src_path,
                fps=30,
            )
            _set_progress(job_id, 25, "スイングの特徴を抽出中")
            df = analyzer.extract_metrics(src_path)
            df.to_csv(str(data_path))
            _set_progress(job_id, 55, "解析動画を生成中")

            def progress_cb(p: int):
                hud_progress = 55 + int((p / 100) * 40)
                _set_progress(job_id, hud_progress, "解析動画を生成中")

            events, fps = analyzer.render_hud(
                src_path,
                df,
                str(hud_path),
                progress_cb=progress_cb,
            )
            register_asset_owner(src_name, actor_key)
            register_asset_owner(hud_name, actor_key)
            register_asset_owner(data_name, actor_key)

            progress_store[job_id] = {
                "status": "done",
                "progress": 100,
                "message": "解析が完了しました",
                "result": {
                    "fps": fps,
                    "events": {
                        "start": int(events["Start"]),
                        "top": int(events["Top"]),
                        "impact": int(events["Impact"]),
                        "finish": int(events["Finish"]),
                    },
                    "source_video_url": _make_media_video_url(src_name),
                    "video_url": _make_media_video_url(hud_name),
                },
            }
        except Exception as e:
            _set_error(job_id, e)
        finally:
            try:
                Path(input_path).unlink(missing_ok=True)
            except Exception:
                pass

    asyncio.create_task(run_in_threadpool(sync_run))
    return {"job_id": job_id}


@router.post("/preview")
async def analyze_preview(
    request: Request,
    video: UploadFile = File(...),
    user=Depends(get_current_user_if_present),
):
    actor_key, rate_limiter_actor = _resolve_actor(request, user)
    enforce_rate_limit(
        key=f"analyze:preview:{rate_limiter_actor}:{request.client.host if request.client else 'unknown'}",
        limit=6,
        window_seconds=60,
    )

    preview_name = f"preview_{uuid.uuid4().hex}.mp4"
    preview_path = VIDEOS_DIR / preview_name
    input_path = await _save_upload_to_temp(video)

    try:
        ffmpeg_to_cfr(
            input_path=input_path,
            output_path=preview_path,
        )
        register_asset_owner(preview_name, actor_key)
        return {"video_url": _make_media_video_url(preview_name)}
    finally:
        try:
            Path(input_path).unlink(missing_ok=True)
        except Exception:
            pass


@router.post("/compare")
async def analyze_compare(
    request: Request,
    left: UploadFile = File(...),
    right: UploadFile = File(...),
    user=Depends(get_current_user_if_present),
):
    actor_key, rate_limiter_actor = _resolve_actor(request, user)
    enforce_rate_limit(
        key=f"analyze:compare:{rate_limiter_actor}:{request.client.host if request.client else 'unknown'}",
        limit=4,
        window_seconds=60,
    )
    job_id = uuid.uuid4().hex
    job_owner[job_id] = actor_key
    progress_store[job_id] = {"status": "processing", "progress": 0}

    left_path = None
    right_path = None
    try:
        left_path = await _save_upload_to_temp(left)
        right_path = await _save_upload_to_temp(right)
    except Exception:
        if left_path:
            Path(left_path).unlink(missing_ok=True)
        raise

    def sync_run():
        left_cfr = None
        right_cfr = None
        try:
            progress_store[job_id]["progress"] = 5
            left_cfr = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4").name
            right_cfr = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4").name
            ffmpeg_to_cfr(input_path=left_path, output_path=left_cfr, fps=30)
            ffmpeg_to_cfr(input_path=right_path, output_path=right_cfr, fps=30)

            df_l = analyzer.extract_metrics(left_cfr)
            df_r = analyzer.extract_metrics(right_cfr)
            progress_store[job_id]["progress"] = 20

            l_name = f"compare_left_{job_id}.mp4"
            r_name = f"compare_right_{job_id}.mp4"
            l_path = VIDEOS_DIR / l_name
            r_path = VIDEOS_DIR / r_name

            def cb(p):
                progress_store[job_id]["progress"] = 20 + int(p * 0.8)

            ev_l, fps_l = analyzer.render_hud(
                left_cfr, df_l, str(l_path), progress_cb=cb
            )
            ev_r, fps_r = analyzer.render_hud(
                right_cfr, df_r, str(r_path), progress_cb=cb
            )
            register_asset_owner(l_name, actor_key)
            register_asset_owner(r_name, actor_key)

            progress_store[job_id] = {
                "status": "done",
                "progress": 100,
                "result": {
                    "left": {
                        "video_url": _make_media_video_url(l_name),
                        "events": {k.lower(): int(v) for k, v in ev_l.items()},
                        "fps": fps_l,
                    },
                    "right": {
                        "video_url": _make_media_video_url(r_name),
                        "events": {k.lower(): int(v) for k, v in ev_r.items()},
                        "fps": fps_r,
                    },
                },
            }
        except Exception as e:
            _set_error(job_id, e)
        finally:
            Path(left_path).unlink(missing_ok=True)
            Path(right_path).unlink(missing_ok=True)
            if left_cfr:
                Path(left_cfr).unlink(missing_ok=True)
            if right_cfr:
                Path(right_cfr).unlink(missing_ok=True)

    asyncio.create_task(run_in_threadpool(sync_run))
    return {"job_id": job_id}


@router.get("/progress/{job_id}")
async def analyze_progress(
    job_id: str,
    request: Request,
    token: str | None = Query(None),
    anonymous_id: str | None = Query(None),
):
    actor_key = _resolve_progress_actor(request, token, anonymous_id)
    if job_owner.get(job_id) != actor_key:
        raise HTTPException(status_code=403, detail="Forbidden")

    async def event_generator():
        while True:
            data = progress_store.get(job_id)

            if data is None:
                yield f"data: {json.dumps({'status':'not_found'})}\n\n"
                break

            yield f"data: {json.dumps(_sanitize_progress_payload(data))}\n\n"

            if data.get("status") in ("done", "error"):
                break

            await asyncio.sleep(0.2)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
    )
