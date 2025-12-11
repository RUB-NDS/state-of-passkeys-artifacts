import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse

from src.api.auth import get_current_admin
from src.api.models import (
    StatusResponse, DirectoryInfo, TaskResponse,
    FileListResponse, DirectoryFilesResponse
)
from src.core.fetch import fetch_directories
from src.directories import Directories
from src.api.task_manager import task_manager, TaskStatus


router = APIRouter(prefix="/api/admin", tags=["admin"])

# Get DATA_DIR from environment
DATA_DIR = os.getenv("DATA_DIR", "../data")


@router.get("/status", response_model=StatusResponse)
async def get_admin_status() -> StatusResponse:
    """Get system status and data overview (public read-only)"""
    data_dir = Path(DATA_DIR)

    status = {
        "directories": {},
        "wellknown": {},
        "combined": 0,
        "merged": 0,
        "conflicts": 0
    }

    # Count files in each directory
    for directory in Directories:
        dir_path = data_dir / "directories" / directory.value
        if dir_path.exists():
            status["directories"][directory.value] = len(list(dir_path.glob("*.json")))

    # Count wellknown files
    for wellknown_type in ["webauthn", "endpoints"]:
        wellknown_path = data_dir / "wellknown" / wellknown_type
        if wellknown_path.exists():
            status["wellknown"][wellknown_type] = len(list(wellknown_path.glob("*.json")))

    # Count combined, merged, conflicts
    if (data_dir / "combined").exists():
        status["combined"] = len(list((data_dir / "combined").glob("*.json")))

    if (data_dir / "merged").exists():
        status["merged"] = len(list((data_dir / "merged").glob("*.json")))

    if (data_dir / "conflicts").exists():
        status["conflicts"] = len(list((data_dir / "conflicts").glob("*.json")))

    return StatusResponse(**status)


@router.get("/directories", response_model=List[DirectoryInfo])
async def list_directories() -> List[DirectoryInfo]:
    """List all available directories (public read-only)"""
    return [DirectoryInfo(name=d.name, value=d.value) for d in Directories]


@router.post("/fetch/{directory}", response_model=TaskResponse)
async def admin_fetch_directory(
    directory: str,
    background_tasks: BackgroundTasks,
    admin: str = Depends(get_current_admin)
) -> TaskResponse:
    """Fetch data for a specific directory"""
    if directory not in Directories.__members__:
        raise HTTPException(status_code=404, detail="Directory not found")

    # Create task
    task_id = await task_manager.create_task("Fetch", f"Fetching {directory}")

    # Run fetch with task tracking
    async def fetch_with_tracking():
        try:
            results = fetch_directories([Directories[directory]], DATA_DIR)
            if results and results[0]["status"] == "success":
                await task_manager.update_task(task_id, TaskStatus.SUCCESS, f"Fetched {results[0]['entries']} entries")
            else:
                await task_manager.update_task(task_id, TaskStatus.ERROR, results[0].get("error", "Failed"))
        except Exception as e:
            await task_manager.update_task(task_id, TaskStatus.ERROR, str(e))

    background_tasks.add_task(fetch_with_tracking)

    return TaskResponse(
        status="started",
        message=f"Fetching data for {directory}",
        task_id=task_id
    )


@router.get("/files/{data_type}")
async def list_data_files(
    data_type: str
) -> Dict[str, Any]:
    """List files in data directories"""
    valid_types = ["directories", "wellknown", "combined", "merged", "conflicts"]
    if data_type not in valid_types:
        raise HTTPException(status_code=400, detail="Invalid data type")

    result = {}
    base_path = Path(DATA_DIR) / data_type

    if base_path.exists():
        if data_type in ["directories", "wellknown"]:
            for subdir in base_path.iterdir():
                if subdir.is_dir():
                    result[subdir.name] = sorted([f.name for f in subdir.glob("*.json")])
        else:
            result["files"] = sorted([f.name for f in base_path.glob("*.json")])

    return result


@router.delete("/files/{data_type}/{filename}")
async def delete_data_file(
    data_type: str,
    filename: str,
    admin: str = Depends(get_current_admin)
) -> Dict[str, str]:
    """Delete a specific data file"""
    valid_types = ["combined", "merged", "conflicts"]
    if data_type not in valid_types:
        raise HTTPException(status_code=400, detail="Cannot delete from this data type")

    file_path = Path(DATA_DIR) / data_type / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    file_path.unlink()
    return {"message": f"File {filename} deleted successfully"}


@router.get("/tasks")
async def get_tasks(
    status: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Get all tasks or filter by status (public read-only)"""
    task_status = TaskStatus(status) if status else None
    tasks = await task_manager.get_tasks(task_status)
    return [task.to_dict() for task in tasks]


@router.get("/tasks/{task_id}")
async def get_task(
    task_id: str
) -> Dict[str, Any]:
    """Get a specific task (public read-only)"""
    task = await task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task.to_dict()
