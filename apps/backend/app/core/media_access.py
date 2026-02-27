import base64
import hashlib
import hmac
import json
import os
import secrets
import threading
import time

from fastapi import HTTPException

_asset_owner: dict[str, str] = {}
_lock = threading.Lock()

_secret = os.getenv("MEDIA_TOKEN_SECRET") or secrets.token_hex(32)
MEDIA_TOKEN_TTL_SECONDS = int(os.getenv("MEDIA_TOKEN_TTL_SECONDS", "3600"))


def register_asset_owner(filename: str, owner_user_id: str) -> None:
    with _lock:
        _asset_owner[filename] = owner_user_id


def is_asset_owner(filename: str, owner_user_id: str) -> bool:
    with _lock:
        return _asset_owner.get(filename) == owner_user_id


def assert_asset_owner(filename: str, owner_user_id: str) -> None:
    if not is_asset_owner(filename, owner_user_id):
        raise HTTPException(status_code=403, detail="Forbidden")


def assert_asset_owner_any(filename: str, owner_keys: list[str]) -> str:
    with _lock:
        owner = _asset_owner.get(filename)
    if owner is None or owner not in owner_keys:
        raise HTTPException(status_code=403, detail="Forbidden")
    return owner


def reassign_asset_owner(filename: str, next_owner_key: str) -> None:
    with _lock:
        _asset_owner[filename] = next_owner_key


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64url_decode(text: str) -> bytes:
    padding = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + padding)


def issue_media_token(filename: str, media_kind: str, ttl_seconds: int | None = None) -> str:
    expires_at = int(time.time() + (ttl_seconds or MEDIA_TOKEN_TTL_SECONDS))
    payload = {
        "f": filename,
        "k": media_kind,
        "exp": expires_at,
    }
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    digest = hmac.new(_secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256)
    sig_b64 = _b64url_encode(digest.digest())
    return f"{payload_b64}.{sig_b64}"


def verify_media_token(token: str, filename: str, media_kind: str) -> bool:
    try:
        payload_b64, sig_b64 = token.split(".", 1)
        expected = hmac.new(
            _secret.encode("utf-8"),
            payload_b64.encode("ascii"),
            hashlib.sha256,
        )
        expected_sig_b64 = _b64url_encode(expected.digest())
        if not hmac.compare_digest(expected_sig_b64, sig_b64):
            return False

        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        if payload.get("f") != filename:
            return False
        if payload.get("k") != media_kind:
            return False
        if int(payload.get("exp", 0)) < int(time.time()):
            return False
        return True
    except Exception:
        return False
