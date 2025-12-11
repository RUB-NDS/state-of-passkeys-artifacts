import time
from typing import Iterable
from configs import throws


def schedule(scan_config: throws.ScanConfig, task_config: throws.TaskConfig) -> Iterable[throws.AnalysisConfig]:
    for _ in range(scan_config.count):
        if task_config.throws_in_schedule:
            raise Exception("demo exception in schedule")
        yield throws.AnalysisConfig()


def start(task_config: throws.TaskConfig, analysis_config: throws.AnalysisConfig) -> dict:
    time.sleep(5) # do some heavy work
    if task_config.throws_in_start:
        raise Exception("demo exception in start")
    return {"foo": "bar"}
