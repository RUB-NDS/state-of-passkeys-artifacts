from fastapi import APIRouter, BackgroundTasks
from modules.db import tasks, tags
from modules.models import ApiResponse
from modules.lfs import delete_in_minio
from modules.tasks import execute


router = APIRouter(prefix="/scans", tags=["scans"])


@router.get("")
def get_scans(task_name: str, offset: int = 0, limit: int = 10, tag_name: str = ""):
    scan_ids = tasks[task_name].distinct("args.1")

    if tag_name:
        tag = tags.find_one({"tag_name": tag_name})
        if tag: scan_ids = [sid for sid in scan_ids if sid in tag["scan_ids"]]
        else: scan_ids = []

    filtered = []
    for scan_id in scan_ids[offset:offset+limit]:
        tag_names = [t["tag_name"] for t in tags.find({"scan_ids": scan_id})]
        first_task = tasks[task_name].find_one({"args.1": scan_id}, sort=[("date_done", 1)])
        last_task = tasks[task_name].find_one({"args.1": scan_id}, sort=[("date_done", -1)])
        filtered.append({
            "scan_id": scan_id,
            "scan_date_first": first_task["date_done"],
            "scan_date_last": last_task["date_done"],

            "count_all": tasks[task_name].count_documents({"args.1": scan_id}),
            "count_started": tasks[task_name].count_documents({"args.1": scan_id, "status": "STARTED"}),
            "count_success": tasks[task_name].count_documents({"args.1": scan_id, "status": "SUCCESS"}),
            "count_retry": tasks[task_name].count_documents({"args.1": scan_id, "status": "RETRY"}),
            "count_failure": tasks[task_name].count_documents({"args.1": scan_id, "status": "FAILURE"}),

            "scan_config_first": first_task["args"][3],
            "task_config_first": first_task["args"][4],
            "analysis_config_first": first_task["args"][5],
            "scan_config_last": last_task["args"][3],
            "task_config_last": last_task["args"][4],
            "analysis_config_last": last_task["args"][5],

            "tag_names": tag_names
        })

    return ApiResponse(success=True, error=None, data={"total": len(scan_ids), "filtered": filtered})


def delete_scans_background(task_name: str, scan_id: str):
    for d in tasks[task_name].find({"args.1": scan_id}):
        delete_in_minio(d["result"])
    tasks[task_name].delete_many({"args.1": scan_id})


@router.delete("")
def delete_scans(task_name: str, scan_id: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(delete_scans_background, task_name, scan_id)
    return ApiResponse(success=True, error=None, data=None)


def rescan_scans_background(task_name: str, scan_id: str):
    for d in tasks[task_name].find({"args.1": scan_id, "status": "FAILURE"}):
        execute.apply_async(args=d["args"], task_id=d["args"][2], queue=d["queue"])


@router.put("")
def rescan_scans(task_name: str, scan_id: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(rescan_scans_background, task_name, scan_id)
    return ApiResponse(success=True, error=None, data=None)
