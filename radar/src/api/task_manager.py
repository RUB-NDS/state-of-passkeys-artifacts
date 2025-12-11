"""Simple in-memory task manager for tracking background tasks"""
from datetime import datetime
from typing import Dict, List, Optional
from enum import Enum
import uuid
import asyncio


class TaskStatus(str, Enum):
    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"


class TaskInfo:
    def __init__(self, task_type: str, description: str):
        self.id = str(uuid.uuid4())
        self.type = task_type
        self.description = description
        self.status = TaskStatus.RUNNING
        self.start_time = datetime.now()
        self.end_time: Optional[datetime] = None
        self.result: Optional[str] = None
        self.progress: Optional[int] = None
        
    def complete(self, result: str):
        self.status = TaskStatus.SUCCESS
        self.end_time = datetime.now()
        self.result = result
        
    def fail(self, error: str):
        self.status = TaskStatus.ERROR
        self.end_time = datetime.now()
        self.result = error
        
    def to_dict(self):
        return {
            "id": self.id,
            "type": self.type,
            "description": self.description,
            "status": self.status,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "result": self.result,
            "progress": self.progress,
            "duration_seconds": (self.end_time - self.start_time).total_seconds() if self.end_time else None
        }


class TaskManager:
    def __init__(self):
        self._tasks: Dict[str, TaskInfo] = {}
        self._lock = asyncio.Lock()
        
    async def create_task(self, task_type: str, description: str) -> str:
        """Create and register a new task, return its ID"""
        async with self._lock:
            task = TaskInfo(task_type, description)
            self._tasks[task.id] = task
            
            # Clean up old completed tasks (keep last 100)
            completed_tasks = [t for t in self._tasks.values() if t.status != TaskStatus.RUNNING]
            if len(completed_tasks) > 100:
                # Sort by end time and remove oldest
                completed_tasks.sort(key=lambda t: t.end_time or datetime.min)
                for task in completed_tasks[:-100]:
                    del self._tasks[task.id]
                    
            return task.id
    
    async def update_task(self, task_id: str, status: TaskStatus, result: Optional[str] = None):
        """Update task status"""
        async with self._lock:
            if task_id in self._tasks:
                task = self._tasks[task_id]
                if status == TaskStatus.SUCCESS:
                    task.complete(result or "Completed")
                elif status == TaskStatus.ERROR:
                    task.fail(result or "Failed")
                    
    async def get_tasks(self, status: Optional[TaskStatus] = None) -> List[TaskInfo]:
        """Get all tasks or filter by status"""
        async with self._lock:
            tasks = list(self._tasks.values())
            if status:
                tasks = [t for t in tasks if t.status == status]
            # Sort by start time, newest first
            tasks.sort(key=lambda t: t.start_time, reverse=True)
            return tasks
            
    async def get_task(self, task_id: str) -> Optional[TaskInfo]:
        """Get a specific task"""
        async with self._lock:
            return self._tasks.get(task_id)


# Global task manager instance
task_manager = TaskManager()