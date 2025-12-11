from fastapi import APIRouter
from modules.db import tags
from modules.models import ApiResponse


router = APIRouter(prefix="/tags", tags=["tags"])


@router.post("")
def add_tags(scan_id: str, tag_name: str):
    tags.update_one({"tag_name": tag_name}, {"$addToSet": {"scan_ids": scan_id}}, upsert=True)
    return ApiResponse(success=True, error=None, data=None)


@router.delete("")
def delete_tags(scan_id: str, tag_name: str):
    tags.update_one({"tag_name": tag_name}, {"$pull": {"scan_ids": scan_id}})
    tags.delete_one({"tag_name": tag_name, "scan_ids": []})
    return ApiResponse(success=True, error=None, data=None)
