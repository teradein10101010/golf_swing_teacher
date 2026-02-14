import os

from app.core.config import FREE_ACCESS
from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


class _MissingSupabase:
    def table(self, *_args, **_kwargs):
        raise RuntimeError("Supabase is not configured")


if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
elif FREE_ACCESS:
    supabase = _MissingSupabase()
else:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
