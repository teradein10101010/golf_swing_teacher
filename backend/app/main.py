from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes.analyze import router as analyze_router
from app.api.routes.auth import router as auth_router
from app.core.config import DATA_DIR, VIDEOS_DIR

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/videos", StaticFiles(directory=VIDEOS_DIR), name="videos")
app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")

app.include_router(auth_router)
app.include_router(analyze_router)
