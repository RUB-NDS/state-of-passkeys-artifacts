from typing import Iterable
from configs import origins
from modules.schedule import schedule_origin


def schedule(scan_config: origins.ScanConfig, task_config: origins.TaskConfig) -> Iterable[origins.AnalysisConfig]:
    for analysis_config in schedule_origin(scan_config, task_config):
        yield analysis_config


def start(task_config: origins.TaskConfig, analysis_config: origins.AnalysisConfig) -> dict:
    return {
        "origin": analysis_config.origin,
        "rank": analysis_config.rank
    }
