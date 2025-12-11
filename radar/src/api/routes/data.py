import os
import json
from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from src.api.models import DataResponse
from src.core.merge_data import merge_data as perform_merge
from src.merge import merge
from src.helpers import get_all_ids, get_closest_id


router = APIRouter(prefix="/api/data", tags=["data"])

# Get DATA_DIR from environment
DATA_DIR = os.getenv("DATA_DIR", "../data")


@router.get("/combined/{date}", response_model=DataResponse)
async def get_combined_data(date: str) -> DataResponse:
    """Get combined data for a specific date"""
    file_path = f"{DATA_DIR}/combined/{date}.json"
    
    if not os.path.exists(file_path):
        # Try to find closest date
        all_combined = get_all_ids(f"{DATA_DIR}/combined")
        if not all_combined:
            raise HTTPException(status_code=404, detail="No combined data available")
        
        closest = get_closest_id(all_combined, date)
        if not closest:
            raise HTTPException(status_code=404, detail="No combined data found for this date")
        
        file_path = f"{DATA_DIR}/combined/{closest}.json"
        actual_date = closest
    else:
        actual_date = date
    
    with open(file_path) as f:
        data = json.load(f)
    
    return DataResponse(
        date=date,
        actual_date=actual_date if actual_date != date else None,
        data=data
    )


@router.get("/merged/{date}", response_model=DataResponse)
async def get_merged_data(date: str) -> DataResponse:
    """Get merged data for a specific date, generate if missing"""
    file_path = f"{DATA_DIR}/merged/{date}.json"
    
    if not os.path.exists(file_path):
        # Check if combined file exists
        combined_path = f"{DATA_DIR}/combined/{date}.json"
        if not os.path.exists(combined_path):
            # Find closest combined file
            all_combined = get_all_ids(f"{DATA_DIR}/combined")
            if not all_combined:
                raise HTTPException(status_code=404, detail="No combined data available")
            
            closest = get_closest_id(all_combined, date)
            if not closest:
                raise HTTPException(status_code=404, detail="No combined data found for this date")
            
            date = closest
            combined_path = f"{DATA_DIR}/combined/{date}.json"
            file_path = f"{DATA_DIR}/merged/{date}.json"
        
        # Generate merged file if it doesn't exist
        if not os.path.exists(file_path):
            with open(combined_path) as f:
                combined = json.load(f)
                merged, conflicts = merge(combined)
                
                os.makedirs(f"{DATA_DIR}/merged", exist_ok=True)
                with open(file_path, "w") as f:
                    json.dump(merged, f, indent=4)
                
                os.makedirs(f"{DATA_DIR}/conflicts", exist_ok=True)
                with open(f"{DATA_DIR}/conflicts/{date}.json", "w") as f:
                    json.dump(conflicts, f, indent=4)
    
    with open(file_path) as f:
        data = json.load(f)
    
    # Convert list to dict with domain as key if it's a list
    if isinstance(data, list):
        data_dict = {}
        for idx, item in enumerate(data):
            # Use domain as key, or index if domain is missing or None
            domain = item.get("domain")
            if domain:
                key = str(domain)
            else:
                # Use name if domain is missing, or index as last resort
                name = item.get("name")
                if name:
                    key = f"name_{name}_{idx}"
                else:
                    key = f"item_{idx}"
            data_dict[key] = item
        data = data_dict
    
    return DataResponse(date=date, data=data)