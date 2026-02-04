import os
import time
import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, jwk
from jose.utils import base64url_decode

security = HTTPBearer()

JWKS_CACHE = {"keys": None, "fetched_at": 0}
JWKS_TTL_SEC = 60 * 60


def _get_jwks():
    supabase_url = os.getenv("SUPABASE_URL")
    if not supabase_url:
        raise HTTPException(status_code=500, detail="SUPABASE_URL not set")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
    if not supabase_anon_key:
        raise HTTPException(status_code=500, detail="SUPABASE_ANON_KEY not set")

    now = time.time()
    if JWKS_CACHE["keys"] and (now - JWKS_CACHE["fetched_at"]) < JWKS_TTL_SEC:
        return JWKS_CACHE["keys"]

    url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
    try:
        resp = httpx.get(
            url,
            headers={"apikey": supabase_anon_key},
            timeout=5.0,
        )
        resp.raise_for_status()
        keys = resp.json().get("keys", [])
    except Exception:
        raise HTTPException(status_code=503, detail="Failed to fetch JWKS")

    JWKS_CACHE["keys"] = keys
    JWKS_CACHE["fetched_at"] = now
    return keys


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials

    try:
        header = jwt.get_unverified_header(token)
        claims = jwt.get_unverified_claims(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    alg = header.get("alg")
    kid = header.get("kid")

    if alg == "HS256":
        supabase_jwt_secret = os.getenv("SUPABASE_JWT_SECRET")
        if not supabase_jwt_secret:
            raise HTTPException(status_code=500, detail="SUPABASE_JWT_SECRET not set")
        try:
            payload = jwt.decode(
                token,
                supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
            return payload
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid token")

    if not kid:
        raise HTTPException(status_code=401, detail="Invalid token")

    keys = _get_jwks()
    key = next((k for k in keys if k.get("kid") == kid), None)
    if not key:
        raise HTTPException(status_code=401, detail="Invalid token")

    public_key = jwk.construct(key)
    message, encoded_sig = token.rsplit(".", 1)
    decoded_sig = base64url_decode(encoded_sig.encode("utf-8"))

    if not public_key.verify(message.encode("utf-8"), decoded_sig):
        raise HTTPException(status_code=401, detail="Invalid token")

    now = int(time.time())
    if claims.get("exp") and now > int(claims["exp"]):
        raise HTTPException(status_code=401, detail="Token expired")
    if claims.get("aud") != "authenticated":
        raise HTTPException(status_code=401, detail="Invalid token")

    return claims  # user_id, email などが入っている
