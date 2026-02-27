from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.core.config import VIDEOS_DIR
from app.core.media_access import verify_media_token

router = APIRouter(prefix="/api/media")


@router.get("/videos/{filename}")
def get_video_file(filename: str, token: str = Query(..., min_length=1)):
    safe_name = Path(filename).name
    if safe_name != filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not verify_media_token(token, safe_name, "video"):
        raise HTTPException(status_code=403, detail="Invalid media token")

    path = VIDEOS_DIR / safe_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Video not found")

    return FileResponse(path, media_type="video/mp4", filename=safe_name)
