from pydantic import BaseModel


class ScanConfig(BaseModel):
    pass


class TaskConfig(BaseModel):
    text: str = "Hello, World!"


class AnalysisConfig(BaseModel):
    pass
