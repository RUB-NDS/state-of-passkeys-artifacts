import os
import sys
from uuid import uuid4
from inspect import signature
from importlib import import_module
from typing import Iterable, Callable
from pydantic import BaseModel
from modules.env import env
from modules.celery import celery
from modules.logging import get_logger
from modules.lfs import store_in_minio
from modules.exceptions import TaskNotFoundError, TaskConfigError, TaskExecutionError, TaskStorageError


logger = get_logger(__name__)


def load() -> list[tuple[str, Callable, Callable, BaseModel, BaseModel, BaseModel]]:
    tasks = []

    tasks_dir = env["TASKS_DIR"]
    if not os.path.exists(tasks_dir):
        logger.warning(f"Tasks directory not found: {tasks_dir}")
        return tasks
    if not os.path.isdir(tasks_dir):
        logger.warning(f"Tasks directory not a directory: {tasks_dir}")
        return tasks
    if not "configs" in os.listdir(tasks_dir):
        logger.warning(f"Tasks directory missing configs: {tasks_dir}")
        return tasks
    if not os.path.isdir(os.path.join(tasks_dir, "configs")):
        logger.warning(f"Tasks directory configs not a directory: {tasks_dir}")
        return tasks
    if not "sources" in os.listdir(tasks_dir):
        logger.warning(f"Tasks directory missing sources: {tasks_dir}")
        return tasks
    if not os.path.isdir(os.path.join(tasks_dir, "sources")):
        logger.warning(f"Tasks directory sources not a directory: {tasks_dir}")
        return tasks

    task_names = set()
    for file in os.listdir(os.path.join(tasks_dir, "sources")):
        file_path = os.path.join(tasks_dir, "sources", file)
        if os.path.isfile(file_path):
            task_name = os.path.splitext(file)[0]
            task_names.add(task_name)
    for file in os.listdir(os.path.join(tasks_dir, "configs")):
        file_path = os.path.join(tasks_dir, "configs", file)
        if os.path.isfile(file_path):
            task_name = os.path.splitext(file)[0]
            task_names.add(task_name)

    for task_name in task_names:

        # load config
        config_file = f"{task_name}.py"
        config_path = os.path.join(tasks_dir, "configs", config_file)
        if not os.path.exists(config_path):
            logger.error(f"Config file not found: {config_path}")
            continue

        # parse config
        try:
            if tasks_dir not in sys.path: sys.path.insert(0, tasks_dir)
            config_module = import_module(f"configs.{task_name}")
            scan_config_class = getattr(config_module, "ScanConfig")
            task_config_class = getattr(config_module, "TaskConfig")
            analysis_config_class = getattr(config_module, "AnalysisConfig")
        except Exception as e:
            logger.error(f"Config file not parsable: {e}")
            continue

        # validate config
        try:
            assert issubclass(scan_config_class, BaseModel)
            assert issubclass(task_config_class, BaseModel)
            assert issubclass(analysis_config_class, BaseModel)
        except Exception as e:
            logger.error(f"Config file validation failed: {e}")
            continue

        logger.debug(f"Config loaded: {task_name}")

        # load source
        source_file = f"{task_name}.py"
        source_path = os.path.join(tasks_dir, "sources", source_file)
        if not os.path.exists(source_path):
            logger.error(f"Source file not found: {source_path}")
            continue

        # parse source
        try:
            if tasks_dir not in sys.path: sys.path.insert(0, tasks_dir)
            source_module = import_module(f"sources.{task_name}")
        except Exception as e:
            logger.error(f"Source file not parsable: {e}")
            continue

        # validate task
        try:
            assert hasattr(source_module, "schedule")
            assert hasattr(source_module, "start")

            schedule = getattr(source_module, "schedule")
            start = getattr(source_module, "start")
            assert callable(schedule)
            assert callable(start)

            schedule_params = signature(schedule).parameters
            start_params = signature(start).parameters
            assert len(schedule_params) == 2
            assert len(start_params) == 2
            assert "scan_config" in schedule_params
            assert "task_config" in schedule_params
            assert "task_config" in start_params
            assert "analysis_config" in start_params

            assert schedule_params["scan_config"].annotation == scan_config_class
            assert schedule_params["task_config"].annotation == task_config_class
            assert start_params["task_config"].annotation == task_config_class
            assert start_params["analysis_config"].annotation == analysis_config_class

            assert signature(schedule).return_annotation == Iterable[analysis_config_class]
            assert signature(start).return_annotation == dict
        except Exception as e:
            logger.error(f"Source file validation failed: {e}")
            logger.exception(e)
            continue

        logger.debug(f"Source loaded: {task_name}")

        tasks.append((task_name, schedule, start, scan_config_class, task_config_class, analysis_config_class))

    return tasks


@celery.task(autoretry_for=(TaskExecutionError, TaskStorageError), default_retry_delay=5)
def execute(task_name: str, scan_id: str, task_id: str, scan_config: dict, task_config: dict, analysis_config: dict):
    tasks = load()

    task = next((t for t in tasks if t[0] == task_name), None)
    if not task:
        raise TaskNotFoundError(f"Task not found: {task_name}")

    try:
        scan_config_model = task[3](**scan_config)
        task_config_model = task[4](**task_config)
        analysis_config_model = task[5](**analysis_config)
    except Exception as e:
        raise TaskConfigError(f"Task config failed: {e}")

    try:
        r = task[2](task_config_model, analysis_config_model)
    except Exception as e:
        raise TaskExecutionError(f"Task execution failed: {e}")

    try:
        store_in_minio(task_name, scan_id, task_id, r)
    except Exception as e:
        raise TaskStorageError(f"Task storage failed: {e}")

    return r


def dispatch(task_name: str, scan_config: BaseModel, task_config: BaseModel, queue: str) -> tuple[bool, str|None]:
    tasks = load()

    task = next((t for t in tasks if t[0] == task_name), None)
    if not task:
        return False, f"Task not found: {task_name}"

    if not isinstance(scan_config, task[3]):
        return False, f"Scan config type mismatch: {task_name}"
    if not isinstance(task_config, task[4]):
        return False, f"Task config type mismatch: {task_name}"

    try:
        scan_id = str(uuid4())
        for analysis_config in task[1](scan_config, task_config):
            task_id = str(uuid4())
            scan_config_dict = scan_config.model_dump()
            task_config_dict = task_config.model_dump()
            analysis_config_dict = analysis_config.model_dump()
            execute.apply_async(
                args=[task_name, scan_id, task_id, scan_config_dict, task_config_dict, analysis_config_dict],
                task_id=task_id,
                queue=queue
            )
    except Exception as e:
        return False, f"Schedule failed: {e}"

    return True, None
