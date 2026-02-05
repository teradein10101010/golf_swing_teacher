import hashlib
import os
import time
import urllib.parse
from datetime import datetime
from pathlib import Path

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.config import DATA_DIR, VIDEOS_DIR
from app.services.swing_analyzer import SwingAnalyzer
from supabase_client import supabase

router = APIRouter(prefix="/api")

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
YOUR_DOMAIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")

analyzer = SwingAnalyzer()

checkout_session_cache = {}
CHECKOUT_SESSION_TTL_SEC = 15 * 60


class AIRequest(BaseModel):
    video_path: str


def _is_entitled(user_id: str) -> bool:
    try:
        res = (
            supabase.table("ai_entitlements")
            .select("user_id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return bool(res.data)
    except Exception:
        return False


def _grant_entitlement(user_id: str) -> None:
    supabase.table("ai_entitlements").upsert(
        {
            "user_id": user_id,
            "paid_at": datetime.utcnow().isoformat(),
        },
        on_conflict="user_id",
    ).execute()


def _csv_for_video(video_file_path: Path) -> Path | None:
    stem = video_file_path.stem
    if stem.startswith("hud_"):
        job_id = stem[len("hud_") :]
    elif stem.startswith("src_"):
        job_id = stem[len("src_") :]
    else:
        return None
    return DATA_DIR / f"data_{job_id}.csv"


@router.post("/create-checkout-session")
async def create_checkout_session(request: Request, user=Depends(get_current_user)):
    try:
        data = await request.json()
        video_path = data.get("video_path", "")
        if not video_path:
            raise HTTPException(status_code=400, detail="video_path is required")
        if _is_entitled(user["sub"]):
            return {"already_paid": True}

        encoded_video_path = urllib.parse.quote(video_path)

        cache_key = f"{user['sub']}:{video_path}"
        cached = checkout_session_cache.get(cache_key)
        now = time.time()
        if cached and (now - cached["created_at"]) < CHECKOUT_SESSION_TTL_SEC:
            return {"url": cached["url"]}

        idempotency_key = hashlib.sha256(cache_key.encode("utf-8")).hexdigest()

        checkout_session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[
                {
                    "price_data": {
                        "currency": "jpy",
                        "product_data": {
                            "name": "AIゴルフスイング解析",
                        },
                        "unit_amount": 500,
                    },
                    "quantity": 1,
                },
            ],
            success_url=(
                f"{YOUR_DOMAIN}"
                f"?session_id={{CHECKOUT_SESSION_ID}}"
                f"&video_path={encoded_video_path}"
            ),
            cancel_url=YOUR_DOMAIN,
            client_reference_id=user["sub"],
            customer_email=user.get("email"),
            metadata={"video_path": video_path},
            idempotency_key=idempotency_key,
        )

        checkout_session_cache[cache_key] = {
            "url": checkout_session.url,
            "created_at": now,
        }

        return {"url": checkout_session.url}
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})


@router.post("/analyze/ai-paid")
async def analyze_ai_paid(request: Request, user=Depends(get_current_user)):
    data = await request.json()
    session_id = data.get("session_id")
    video_url_path = data.get("video_path")

    try:
        session = stripe.checkout.Session.retrieve(session_id)
        if session.payment_status != "paid":
            return JSONResponse(
                status_code=403, content={"error": "支払いが完了していません"}
            )
        if session.client_reference_id != user["sub"]:
            return JSONResponse(
                status_code=403,
                content={"error": "この決済は現在のユーザーに紐づいていません"},
            )
    except Exception:
        return JSONResponse(status_code=400, content={"error": "無効なセッションです"})

    if not video_url_path:
        raise HTTPException(status_code=400, detail="video_path is required")

    filename = Path(video_url_path).name
    video_file_path = VIDEOS_DIR / filename

    if not video_file_path.exists():
        raise HTTPException(
            status_code=404, detail=f"Video file not found: {video_file_path}"
        )

    csv_path = _csv_for_video(video_file_path)
    advice_text = analyzer.analyze_video(video_file_path, csv_path=csv_path)
    _grant_entitlement(user["sub"])

    return {"advice": advice_text}


@router.get("/ai/entitlement")
def ai_entitlement(user=Depends(get_current_user)):
    return {"entitled": _is_entitled(user["sub"])}


@router.post("/analyze/ai-entitled")
def analyze_ai_entitled(req: AIRequest, user=Depends(get_current_user)):
    if not _is_entitled(user["sub"]):
        raise HTTPException(status_code=403, detail="Not entitled")
    video_path = VIDEOS_DIR / Path(req.video_path).name
    csv_path = _csv_for_video(video_path)
    advice = analyzer.analyze_video(video_path, csv_path=csv_path)
    return {"advice": advice}


@router.post("/analyze/ai")
def analyze_ai(_: AIRequest):
    raise HTTPException(status_code=403, detail="AIアドバイスは有料機能です")
