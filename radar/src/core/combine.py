import os
import json
from datetime import datetime
from typing import Optional, Dict
from src.helpers import get_all_ids, get_closest_id


def combine_data(date_range: Optional[Dict[str, str]] = None, data_dir: str = "../data") -> dict:
    """Combine data from different sources"""
    all_ids = set()
    
    types = ["directories", "wellknown"]
    for type in types:
        all_ids.update(get_all_ids(f"{data_dir}/{type}"))
    
    # Filter by date range if provided
    if date_range:
        start_date = datetime.strptime(date_range.get("start", "1970-01-01"), "%Y-%m-%d")
        end_date = datetime.strptime(date_range.get("end", datetime.now().strftime("%Y-%m-%d")), "%Y-%m-%d")
        all_ids = {
            id for id in all_ids 
            if start_date <= datetime.strptime(id, "%Y-%m-%d-%H-%M-%S") <= end_date
        }
    
    os.makedirs(f"{data_dir}/combined", exist_ok=True)
    combined_count = 0
    
    for id in all_ids:
        combined = {t: {} for t in types}
        
        for type in types:
            path_type = f"{data_dir}/{type}"
            if not os.path.exists(path_type):
                continue
                
            for subtype in os.listdir(path_type):
                path_subtype = f"{data_dir}/{type}/{subtype}"
                if os.path.isdir(path_subtype):
                    oids = get_all_ids(path_subtype)
                    if not oids:
                        continue
                    
                    closest = get_closest_id(oids, id)
                    if not closest:
                        continue
                    
                    with open(f"{data_dir}/{type}/{subtype}/{closest}.json") as f:
                        data = json.load(f)
                        combined[type][subtype] = data
        
        with open(f"{data_dir}/combined/{id}.json", "w") as f:
            json.dump(combined, f, indent=4)
        combined_count += 1
    
    return {"combined_files": combined_count, "date_range": date_range}