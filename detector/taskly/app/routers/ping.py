from fastapi import APIRouter
from modules.models import ApiResponse


router = APIRouter(prefix="/ping", tags=["ping"])


@router.get("")
def ping() -> ApiResponse:
    return ApiResponse(success=True, error=None, data="pong")
