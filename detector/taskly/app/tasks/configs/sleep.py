from pydantic import BaseModel


class ScanConfig(BaseModel):
    repeat: int = 3


class TaskConfig(BaseModel):
    seconds: int = 5


class AnalysisConfig(BaseModel):
    pass
