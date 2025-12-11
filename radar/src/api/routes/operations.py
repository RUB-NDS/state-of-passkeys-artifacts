import os
from fastapi import APIRouter, BackgroundTasks, Depends
from typing import List, Optional
import asyncio

from src.api.models import FetchRequest, CombineRequest, MergeRequest, TaskResponse
from src.core.fetch import fetch_directories
from src.core.combine import combine_data
from src.core.merge_data import merge_data
from src.directories import Directories
from src.api.task_manager import task_manager, TaskStatus
from src.api.auth import get_current_admin


router = APIRouter(prefix="/api", tags=["operations"])

# Get DATA_DIR from environment
DATA_DIR = os.getenv("DATA_DIR", "../data")


async def run_fetch_with_tracking(task_id: str, directories: Optional[List[Directories]], data_dir: str):
    """Run fetch operation and update task status"""
    try:
        result = await asyncio.to_thread(fetch_directories, directories, data_dir)
        await task_manager.update_task(task_id, TaskStatus.SUCCESS, f"Fetched {len(result)} directories")
    except Exception as e:
        await task_manager.update_task(task_id, TaskStatus.ERROR, str(e))


@router.post("/fetch", response_model=TaskResponse)
async def api_fetch(
    request: FetchRequest, 
    background_tasks: BackgroundTasks,
    admin: str = Depends(get_current_admin)
) -> TaskResponse:
    """Trigger directory fetches"""
    directories = None
    if request.directories:
        directories = [Directories[d] for d in request.directories if d in Directories.__members__]
    
    # Create task
    task_id = await task_manager.create_task(
        "Fetch All",
        f"Fetching {len(directories) if directories else 'all'} directories"
    )
    
    # Run fetch in background with tracking
    background_tasks.add_task(run_fetch_with_tracking, task_id, directories, DATA_DIR)
    
    return TaskResponse(
        status="started",
        message=f"Fetching {len(directories) if directories else 'all'} directories",
        task_id=task_id
    )


async def run_combine_with_tracking(task_id: str, date_range: Optional[str], data_dir: str):
    """Run combine operation and update task status"""
    try:
        result = await asyncio.to_thread(combine_data, date_range, data_dir)
        await task_manager.update_task(task_id, TaskStatus.SUCCESS, f"Combined {len(result)} files")
    except Exception as e:
        await task_manager.update_task(task_id, TaskStatus.ERROR, str(e))


async def run_merge_with_tracking(task_id: str, file: Optional[str], files: Optional[List[str]], data_dir: str):
    """Run merge operation and update task status"""
    try:
        result = await asyncio.to_thread(merge_data, file, files, data_dir)
        await task_manager.update_task(task_id, TaskStatus.SUCCESS, f"Merged {len(result)} files")
    except Exception as e:
        await task_manager.update_task(task_id, TaskStatus.ERROR, str(e))


@router.post("/combine", response_model=TaskResponse)
async def api_combine(
    request: CombineRequest, 
    background_tasks: BackgroundTasks,
    admin: str = Depends(get_current_admin)
) -> TaskResponse:
    """Combine data from different sources"""
    # Create task
    task_id = await task_manager.create_task(
        "Combine",
        "Combining data from all sources"
    )
    
    # Run combine in background with tracking
    background_tasks.add_task(run_combine_with_tracking, task_id, request.date_range, DATA_DIR)
    
    return TaskResponse(
        status="started",
        message="Combining data from all sources",
        task_id=task_id
    )


@router.post("/merge", response_model=TaskResponse)
async def api_merge(
    request: MergeRequest, 
    background_tasks: BackgroundTasks,
    admin: str = Depends(get_current_admin)
) -> TaskResponse:
    """Merge combined data files"""
    # Determine what to merge
    if request.files:
        description = f"Merging {len(request.files)} selected files"
        message = f"Merging {len(request.files)} files"
    elif request.file:
        description = f"Merging file: {request.file}"
        message = f"Merging specific file"
    else:
        description = "Merging all unmerged files"
        message = "Merging all files"
    
    # Create task
    task_id = await task_manager.create_task("Merge", description)
    
    # Run merge in background with tracking
    background_tasks.add_task(run_merge_with_tracking, task_id, request.file, request.files, DATA_DIR)
    
    return TaskResponse(
        status="started",
        message=message,
        task_id=task_id
    )


