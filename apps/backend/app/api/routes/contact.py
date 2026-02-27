import logging

from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.rate_limit import enforce_rate_limit
from supabase_client import supabase

router = APIRouter(prefix="/api/contact")
logger = logging.getLogger(__name__)


class ContactSubmitRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=3, max_length=254)
    message: str = Field(..., min_length=1, max_length=3000)


def _save_contact_inquiry(name: str, email: str, message: str) -> None:
    supabase.table("contact_inquiries").insert(
        {
            "name": name,
            "email": email,
            "message": message,
        }
    ).execute()


@router.post("/submit")
async def submit_contact(req: ContactSubmitRequest, request: Request):
    enforce_rate_limit(
        key=f"contact:{request.client.host if request.client else 'unknown'}",
        limit=5,
        window_seconds=60 * 10,
    )
    try:
        await run_in_threadpool(
            _save_contact_inquiry,
            req.name.strip(),
            req.email.strip(),
            req.message.strip(),
        )
        return {"ok": True}
    except Exception:
        logger.exception("Failed to submit contact inquiry")
        return JSONResponse(
            status_code=500,
            content={"ok": False, "error": "お問い合わせ送信に失敗しました"},
        )
