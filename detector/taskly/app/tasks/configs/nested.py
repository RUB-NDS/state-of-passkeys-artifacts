from pydantic import BaseModel
from configs import echo


class ScanConfig(BaseModel):
    pass


class TaskConfig(BaseModel):
    echo_task_config: echo.TaskConfig = echo.TaskConfig()
    echo_analysis_config: echo.AnalysisConfig = echo.AnalysisConfig()


class AnalysisConfig(BaseModel):
    pass
