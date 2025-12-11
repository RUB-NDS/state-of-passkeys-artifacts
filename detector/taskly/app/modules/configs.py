from typing import Literal, Optional
from pydantic import BaseModel, model_validator


class ScanConfigOrigin(BaseModel):
    type: Literal["origin", "crux", "tranco"] = "origin"

    # origin type fields
    origin: Optional[str] = "https://example.com"

    # crux type fields
    crux_yyyymm: Optional[str] = "202501"

    # tranco type fields
    tranco_yyyymmdd: Optional[str] = "20250101"

    # shared fields
    max_rank: Optional[int] = 1000

    @model_validator(mode="after")
    def validate_fields_by_type(self):
        if self.type == "origin":
            if not self.origin:
                raise ValueError("origin is required when type is 'origin'")
        elif self.type == "crux":
            if not self.crux_yyyymm:
                raise ValueError("crux_yyyymm is required when type is 'crux'")
        elif self.type == "tranco":
            if not self.tranco_yyyymmdd:
                raise ValueError("tranco_yyyymmdd is required when type is 'tranco'")
        return self


class TaskConfigOrigin(BaseModel):
    pass


class AnalysisConfigOrigin(BaseModel):
    origin: str = "https://example.com"
    rank: Optional[int] = None
