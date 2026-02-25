from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from supabase_client import supabase

router = APIRouter(prefix="/api/contact")


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
async def submit_contact(req: ContactSubmitRequest):
    try:
        await run_in_threadpool(
            _save_contact_inquiry,
            req.name.strip(),
            req.email.strip(),
            req.message.strip(),
        )
        return {"ok": True}
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"ok": False, "error": f"お問い合わせ送信に失敗しました: {e}"},
        )
