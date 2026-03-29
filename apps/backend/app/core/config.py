import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parents[2]
VIDEOS_DIR = BASE_DIR / "videos"
DATA_DIR = BASE_DIR / "data"
FREE_ACCESS = os.getenv("FREE_ACCESS", "").lower() in ("1", "true", "yes", "on")
BACKEND_ORIGIN = os.getenv("BACKEND_ORIGIN", "").strip()

VIDEOS_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)
