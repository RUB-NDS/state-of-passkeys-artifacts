from typing import Annotated
from fastapi import APIRouter, Body, BackgroundTasks
from pydantic import BaseModel
from modules.tasks import load, dispatch
from modules.models import ApiResponse


router = APIRouter(prefix="/tasks", tags=["tasks"])


def schema_endpoint(scan_config_class, task_config_class):
    def schema() -> ApiResponse:
        class Schema(BaseModel):
            scan_config: scan_config_class
            task_config: task_config_class
            queue: str = "default"
        return ApiResponse(success=True, error=None, data=Schema.model_json_schema())
    return schema


def create_endpoint(task_name, scan_config_class, task_config_class):
    def create(scan_config: scan_config_class, task_config: task_config_class, background_tasks: BackgroundTasks, queue: Annotated[str, Body()] = "default") -> ApiResponse:
        background_tasks.add_task(dispatch, task_name, scan_config, task_config, queue)
        return ApiResponse(success=True, error=None, data=None)
    return create


for (task_name, schedule, start, scan_config_class, task_config_class, analysis_config_class) in load():
    router.get(f"/{task_name}")(schema_endpoint(scan_config_class, task_config_class))
    router.post(f"/{task_name}")(create_endpoint(task_name, scan_config_class, task_config_class))
