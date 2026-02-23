from typing import Literal, Optional
from pydantic import BaseModel, Field, model_validator


class ScanConfigOrigin(BaseModel):
    type: Literal["origin", "crux", "tranco"] = Field(
        default="origin",
        description="Source type: 'origin' for a single origin, 'crux' for CrUX dataset, 'tranco' for Tranco dataset",
    )

    # origin type fields
    origin: Optional[str] = Field(
        default="https://example.com",
        description="Single origin to scan (required when type is 'origin')",
    )

    # crux type fields
    crux_yyyymm: Optional[str] = Field(
        default="202501",
        description="CrUX dataset month in YYYYMM format (required when type is 'crux')",
    )

    # tranco type fields
    tranco_yyyymmdd: Optional[str] = Field(
        default="20250101",
        description="Tranco dataset date in YYYYMMDD format (required when type is 'tranco')",
    )

    # shared fields
    max_rank: Optional[int] = Field(
        default=1000,
        description="Maximum rank to scan from the dataset",
    )

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
    origin: str = Field(
        default="https://example.com",
        description="Origin URL to analyze",
    )
    rank: Optional[int] = Field(
        default=None,
        description="Rank of the origin in the dataset",
    )
