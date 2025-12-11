from typing import Iterable
from configs import echo


def schedule(scan_config: echo.ScanConfig, task_config: echo.TaskConfig) -> Iterable[echo.AnalysisConfig]:
    yield echo.AnalysisConfig()


def start(task_config: echo.TaskConfig, analysis_config: echo.AnalysisConfig) -> dict:
    return {"echo": task_config.text}
