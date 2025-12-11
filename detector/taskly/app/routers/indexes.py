from fastapi import APIRouter
from modules.tasks import load
from modules.db import tasks, indexes
from modules.models import ApiResponse


router = APIRouter(prefix="/indexes", tags=["indexes"])


@router.get("")
def create_indexes() -> ApiResponse:
    for (task_name, _, _, _, _, _) in load():
        for index in indexes:
            tasks[task_name].create_index(index)
    return ApiResponse(success=True, error=None, data=indexes)
