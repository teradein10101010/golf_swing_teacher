import os
import smtplib
import ssl
from email.message import EmailMessage

from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/contact")


class ContactSubmitRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=3, max_length=254)
    message: str = Field(..., min_length=1, max_length=3000)


def _normalize_env_text(value: str) -> str:
    # Some copy-paste sources insert NBSP (\u00a0), which breaks SMTP auth.
    return (value or "").replace("\u00a0", " ").strip()


def _normalize_gmail_app_password(value: str) -> str:
    # Gmail app passwords are 16 letters; spaces are visual separators only.
    return "".join(_normalize_env_text(value).split())


def _send_contact_email(name: str, email: str, message: str) -> None:
    smtp_host = _normalize_env_text(os.getenv("CONTACT_SMTP_HOST", ""))
    smtp_port = int(os.getenv("CONTACT_SMTP_PORT", "587"))
    smtp_user = _normalize_env_text(os.getenv("CONTACT_SMTP_USER", ""))
    smtp_password = _normalize_gmail_app_password(
        os.getenv("CONTACT_SMTP_PASSWORD", "")
    )
    smtp_starttls = os.getenv("CONTACT_SMTP_STARTTLS", "1").lower() in (
        "1",
        "true",
        "yes",
        "on",
    )
    from_email = _normalize_env_text(os.getenv("CONTACT_FROM_EMAIL", ""))
    to_email = _normalize_env_text(os.getenv("CONTACT_TO_EMAIL", ""))

    if not all([smtp_host, smtp_user, smtp_password, from_email, to_email]):
        raise RuntimeError("Contact mail settings are not configured")

    subject = "【Golf Swing Analyzer】お問い合わせ"
    body = (
        "お問い合わせを受信しました。\n\n"
        f"お名前: {name}\n"
        f"返信先メール: {email}\n\n"
        "本文:\n"
        f"{message}\n"
    )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Reply-To"] = email
    msg.set_content(body)

    context = ssl.create_default_context()
    with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
        if smtp_starttls:
            server.starttls(context=context)
        server.login(smtp_user, smtp_password)
        server.send_message(msg)


@router.post("/submit")
async def submit_contact(req: ContactSubmitRequest):
    try:
        await run_in_threadpool(
            _send_contact_email,
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
