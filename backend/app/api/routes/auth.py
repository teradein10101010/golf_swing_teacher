from fastapi import APIRouter, Depends

from app.core.auth import get_current_user

router = APIRouter(prefix="/api")


@router.get("/me")
def me(user=Depends(get_current_user)):
    return {
        "user_id": user["sub"],
        "email": user.get("email"),
    }
