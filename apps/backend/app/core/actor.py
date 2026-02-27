import re

from fastapi import HTTPException, Request

ANON_ID_HEADER = "x-anonymous-id"
_ANON_ID_RE = re.compile(r"^[a-f0-9]{32}$")


def get_anonymous_id_from_request(request: Request) -> str | None:
    raw = (request.headers.get(ANON_ID_HEADER) or "").strip().lower()
    return normalize_anonymous_id(raw)


def normalize_anonymous_id(raw: str | None) -> str | None:
    raw = (raw or "").strip().lower()
    if not raw:
        return None
    if not _ANON_ID_RE.fullmatch(raw):
        raise HTTPException(status_code=400, detail="Invalid anonymous id")
    return raw


def actor_key_for_user(user_id: str) -> str:
    return f"user:{user_id}"


def actor_key_for_anonymous(anonymous_id: str) -> str:
    return f"anon:{anonymous_id}"
