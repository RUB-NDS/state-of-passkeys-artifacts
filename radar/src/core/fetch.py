import os
import json
from datetime import datetime
from typing import List, Optional
from src.directories import Directories


def fetch_directories(directories: Optional[List[Directories]] = None, data_dir: str = "../data") -> List[dict]:
    """Fetch data from specified directories"""
    if directories is None:
        directories = list(Directories)
    
    today = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    results = []
    
    for d in directories:
        try:
            module = __import__(f"src.directories.{d.name}", fromlist=["get_entries"])
            entries = module.get_entries()
            
            os.makedirs(f"{data_dir}/directories/{d.value}", exist_ok=True)
            with open(f"{data_dir}/directories/{d.value}/{today}.json", "w") as f:
                json.dump(entries, f, indent=4)
            
            results.append({
                "directory": d.value,
                "status": "success",
                "entries": len(entries)
            })
        except Exception as e:
            results.append({
                "directory": d.value,
                "status": "error",
                "error": str(e)
            })
    
    return results