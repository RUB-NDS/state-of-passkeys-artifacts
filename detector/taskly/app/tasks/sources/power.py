from typing import Iterable
from configs import power


def schedule(scan_config: power.ScanConfig, task_config: power.TaskConfig) -> Iterable[power.AnalysisConfig]:
    for i in range(scan_config.start, scan_config.end + 1):
        yield power.AnalysisConfig(base=i)


def start(task_config: power.TaskConfig, analysis_config: power.AnalysisConfig) -> dict:
    return {"power": analysis_config.base ** task_config.exponent}
