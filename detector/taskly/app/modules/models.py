from typing import Any
from pydantic import BaseModel


class ApiResponse(BaseModel):
    success: bool
    error: str|None
    data: Any|None
