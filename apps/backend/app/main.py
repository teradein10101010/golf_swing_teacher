import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.analyze import router as analyze_router
from app.api.routes.auth import router as auth_router
from app.api.routes.contact import router as contact_router
from app.api.routes.media import router as media_router
from app.api.routes.stripe import router as stripe_router

app = FastAPI()

cors_origins = os.getenv("CORS_ORIGINS") or os.getenv("FRONTEND_ORIGIN")
if cors_origins:
    # Normalize (e.g. "http://localhost:5173/" -> "http://localhost:5173") to avoid
    # subtle mismatches that cause missing CORS headers in browsers.
    allow_origins = [
        o.strip().rstrip("/") for o in cors_origins.split(",") if o.strip()
    ]
else:
    allow_origins = ["http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(analyze_router)
app.include_router(stripe_router)
app.include_router(contact_router)
app.include_router(media_router)
