import time
from typing import Iterable
from configs import sleep


def schedule(scan_config: sleep.ScanConfig, task_config: sleep.TaskConfig) -> Iterable[sleep.AnalysisConfig]:
    for _ in range(scan_config.repeat):
        yield sleep.AnalysisConfig()


def start(task_config: sleep.TaskConfig, analysis_config: sleep.AnalysisConfig) -> dict:
    time.sleep(task_config.seconds)
    return {"slept": task_config.seconds}
