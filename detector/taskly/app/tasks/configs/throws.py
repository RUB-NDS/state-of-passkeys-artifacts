from pydantic import BaseModel


class ScanConfig(BaseModel):
    count: int = 1


class TaskConfig(BaseModel):
    throws_in_schedule: bool = False
    throws_in_start: bool = True


class AnalysisConfig(BaseModel):
    pass
