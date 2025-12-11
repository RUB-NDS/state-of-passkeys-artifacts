from pydantic import BaseModel


class ScanConfig(BaseModel):
    start: int = 1
    end: int = 10


class TaskConfig(BaseModel):
    exponent: int = 2


class AnalysisConfig(BaseModel):
    base: int = 2
