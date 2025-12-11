from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime


# Request models
class FetchRequest(BaseModel):
    directories: Optional[List[str]] = None


class CombineRequest(BaseModel):
    date_range: Optional[Dict[str, str]] = None


class MergeRequest(BaseModel):
    file: Optional[str] = None  # Single file (backward compatibility)
    files: Optional[List[str]] = None  # Multiple files for selective merge


# Response models
class TaskResponse(BaseModel):
    status: str
    message: str
    task_id: Optional[str] = None


class DirectoryInfo(BaseModel):
    name: str
    value: str


class FileListResponse(BaseModel):
    files: List[str]


class DirectoryFilesResponse(BaseModel):
    directories: Dict[str, List[str]]


class StatusResponse(BaseModel):
    directories: Dict[str, int]
    wellknown: Dict[str, int]
    combined: int
    merged: int
    conflicts: int


class TemporalStatistic(BaseModel):
    date: str
    total_domains: int
    timestamp: str


class DirectoryStatistic(BaseModel):
    directory: str
    name: str
    count: int


class DirectoryStatisticsResponse(BaseModel):
    date: str
    statistics: List[DirectoryStatistic]


class DataResponse(BaseModel):
    date: str
    actual_date: Optional[str] = None
    data: Dict[str, Any]


class FetchResult(BaseModel):
    directory: str
    status: str
    entries: Optional[int] = None
    error: Optional[str] = None


class CombineResult(BaseModel):
    combined_files: int
    date_range: Optional[Dict[str, str]] = None


class MergeResult(BaseModel):
    file: str
    status: str
    merged_count: Optional[int] = None
    conflicts_count: Optional[int] = None
    error: Optional[str] = None