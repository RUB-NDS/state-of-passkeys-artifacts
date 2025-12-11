from typing import Iterable
from configs import nested


def schedule(scan_config: nested.ScanConfig, task_config: nested.TaskConfig) -> Iterable[nested.AnalysisConfig]:
    yield nested.AnalysisConfig()


def start(task_config: nested.TaskConfig, analysis_config: nested.AnalysisConfig) -> dict:
    from tasks import echo
    r = echo.start(task_config.echo_task_config, task_config.echo_analysis_config)
    return {"result": r}
