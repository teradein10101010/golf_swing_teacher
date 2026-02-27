import hashlib
import logging
import os
import time
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.actor import actor_key_for_anonymous, actor_key_for_user, get_anonymous_id_from_request
from app.core.auth import get_current_user_optional
from app.core.config import DATA_DIR, FREE_ACCESS, VIDEOS_DIR
from app.core.media_access import assert_asset_owner_any, reassign_asset_owner
from app.core.rate_limit import enforce_rate_limit
from app.services.swing_analyzer import (
    MAX_CHAT_MESSAGES,
    MAX_USER_PROMPT_CHARS,
    SwingAnalyzer,
)
from supabase_client import supabase

router = APIRouter(prefix="/api")

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
YOUR_DOMAIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")

analyzer = SwingAnalyzer()
logger = logging.getLogger(__name__)

checkout_session_cache = {}
CHECKOUT_SESSION_TTL_SEC = 15 * 60


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1)


class AIRequest(BaseModel):
    video_path: str
    ai_prompt: str | None = Field(default=None, max_length=MAX_USER_PROMPT_CHARS)
    ai_messages: list[ChatMessage] | None = Field(
        default=None, max_length=MAX_CHAT_MESSAGES
    )


class AIPaidRequest(BaseModel):
    session_id: str
    video_path: str
    ai_prompt: str | None = Field(default=None, max_length=MAX_USER_PROMPT_CHARS)
    ai_messages: list[ChatMessage] | None = Field(
        default=None, max_length=MAX_CHAT_MESSAGES
    )


class AICompareRequest(BaseModel):
    left_video_path: str
    right_video_path: str
    ai_prompt: str | None = Field(default=None, max_length=MAX_USER_PROMPT_CHARS)
    ai_messages: list[ChatMessage] | None = Field(
        default=None, max_length=MAX_CHAT_MESSAGES
    )


def _is_entitled(user_id: str) -> bool:
    if FREE_ACCESS:
        return True
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
    if FREE_ACCESS:
        return
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


def _extract_video_filename(video_path: str) -> str:
    raw = (video_path or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="video_path is required")
    parsed = urlparse(raw)
    candidate_path = parsed.path if parsed.path else raw
    filename = Path(candidate_path).name
    if not filename:
        raise HTTPException(status_code=400, detail="Invalid video_path")
    return filename


def _resolve_owned_video_path(
    video_path: str,
    user_id: str | None = None,
    anonymous_id: str | None = None,
    require_user: bool = True,
) -> tuple[Path, str]:
    if require_user and not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    filename = _extract_video_filename(video_path)
    allowed: list[str] = []
    if user_id:
        allowed.append(actor_key_for_user(user_id))
    if anonymous_id:
        allowed.append(actor_key_for_anonymous(anonymous_id))
    if not allowed:
        raise HTTPException(status_code=401, detail="Authentication required")
    assert_asset_owner_any(filename, allowed)
    resolved = VIDEOS_DIR / filename
    if not resolved.exists():
        raise HTTPException(status_code=404, detail="Video file not found")
    return resolved, filename


@router.post("/create-checkout-session")
async def create_checkout_session(
    request: Request, user=Depends(get_current_user_optional)
):
    enforce_rate_limit(
        key=f"checkout:{request.client.host if request.client else 'unknown'}:{user['sub'] if user else 'anonymous'}",
        limit=10,
        window_seconds=60,
    )
    try:
        if FREE_ACCESS:
            return {"already_paid": True}
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        data = await request.json()
        video_path = data.get("video_path", "")
        anonymous_id = get_anonymous_id_from_request(request)
        _, filename = _resolve_owned_video_path(
            video_path,
            user_id=user["sub"],
            anonymous_id=anonymous_id,
        )
        reassign_asset_owner(filename, actor_key_for_user(user["sub"]))
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
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to create checkout session")
        return JSONResponse(
            status_code=400,
            content={"error": "決済セッションの作成に失敗しました"},
        )


@router.post("/analyze/ai-paid")
async def analyze_ai_paid(
    req: AIPaidRequest,
    request: Request,
    user=Depends(get_current_user_optional),
):
    session_id = req.session_id
    video_url_path = req.video_path

    if not FREE_ACCESS:
        if not user:
            return JSONResponse(
                status_code=401, content={"error": "Authentication required"}
            )
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
            return JSONResponse(
                status_code=400, content={"error": "無効なセッションです"}
            )

    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    anonymous_id = get_anonymous_id_from_request(request)
    video_file_path, filename = _resolve_owned_video_path(
        video_url_path,
        user_id=user["sub"],
        anonymous_id=anonymous_id,
    )
    reassign_asset_owner(filename, actor_key_for_user(user["sub"]))

    csv_path = _csv_for_video(video_file_path)
    advice_text = analyzer.analyze_video(
        video_file_path,
        csv_path=csv_path,
        user_prompt=req.ai_prompt,
        chat_messages=[
            {"role": msg.role, "content": msg.content}
            for msg in (req.ai_messages or [])
        ],
    )
    if user:
        _grant_entitlement(user["sub"])

    return {"advice": advice_text}


@router.get("/ai/entitlement")
def ai_entitlement(user=Depends(get_current_user_optional)):
    if FREE_ACCESS:
        return {"entitled": True, "free_access": True}
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return {"entitled": _is_entitled(user["sub"]), "free_access": False}


@router.post("/analyze/ai-entitled")
def analyze_ai_entitled(
    req: AIRequest,
    request: Request,
    user=Depends(get_current_user_optional),
):
    if not FREE_ACCESS:
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        if not _is_entitled(user["sub"]):
            raise HTTPException(status_code=403, detail="Not entitled")

    anonymous_id = get_anonymous_id_from_request(request)
    video_path, _ = _resolve_owned_video_path(
        req.video_path,
        user_id=user["sub"] if user else None,
        anonymous_id=anonymous_id,
        require_user=not FREE_ACCESS,
    )
    csv_path = _csv_for_video(video_path)
    advice = analyzer.analyze_video(
        video_path,
        csv_path=csv_path,
        user_prompt=req.ai_prompt,
        chat_messages=[
            {"role": msg.role, "content": msg.content}
            for msg in (req.ai_messages or [])
        ],
    )
    return {"advice": advice}


@router.post("/analyze/ai-compare-entitled")
def analyze_ai_compare_entitled(
    req: AICompareRequest,
    request: Request,
    user=Depends(get_current_user_optional),
):
    if not FREE_ACCESS:
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        if not _is_entitled(user["sub"]):
            raise HTTPException(status_code=403, detail="Not entitled")

    anonymous_id = get_anonymous_id_from_request(request)
    left_video_path, _ = _resolve_owned_video_path(
        req.left_video_path,
        user_id=user["sub"] if user else None,
        anonymous_id=anonymous_id,
        require_user=not FREE_ACCESS,
    )
    right_video_path, _ = _resolve_owned_video_path(
        req.right_video_path,
        user_id=user["sub"] if user else None,
        anonymous_id=anonymous_id,
        require_user=not FREE_ACCESS,
    )

    advice = analyzer.analyze_comparison_videos(
        left_video_path,
        right_video_path,
        left_csv_path=_csv_for_video(left_video_path),
        right_csv_path=_csv_for_video(right_video_path),
        user_prompt=req.ai_prompt,
        chat_messages=[
            {"role": msg.role, "content": msg.content}
            for msg in (req.ai_messages or [])
        ],
    )
    return {"advice": advice}


@router.post("/analyze/ai")
def analyze_ai(_: AIRequest):
    if FREE_ACCESS:
        raise HTTPException(
            status_code=400,
            detail="FREE_ACCESS is enabled; use /api/analyze/ai-entitled",
        )
    raise HTTPException(status_code=403, detail="AIアドバイスは有料機能です")
