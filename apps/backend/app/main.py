import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes.analyze import router as analyze_router
from app.api.routes.auth import router as auth_router
from app.api.routes.contact import router as contact_router
from app.api.routes.stripe import router as stripe_router
from app.core.config import DATA_DIR, VIDEOS_DIR

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

app.mount("/videos", StaticFiles(directory=VIDEOS_DIR), name="videos")
app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")

app.include_router(auth_router)
app.include_router(analyze_router)
app.include_router(stripe_router)
app.include_router(contact_router)
