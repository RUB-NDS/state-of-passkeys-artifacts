import os
import json
from typing import Optional, List
from src.merge import merge


def merge_data(file: Optional[str] = None, files: Optional[List[str]] = None, data_dir: str = "../data") -> List[dict]:
    """Merge combined data files
    
    Args:
        file: Single file to merge (backward compatibility)
        files: List of files to merge (for selective merging)
        data_dir: Data directory path
    """
    if files:
        # Use provided list of files
        file_list = files
    elif file:
        # Single file (backward compatibility)
        file_list = [f"{file}.json"] if not file.endswith('.json') else [file]
    else:
        # All files in combined directory
        combined_path = f"{data_dir}/combined"
        if not os.path.exists(combined_path):
            return []
        
        # Get all combined files
        all_combined = os.listdir(combined_path)
        
        # Get already merged files
        merged_path = f"{data_dir}/merged"
        if os.path.exists(merged_path):
            merged_files = set(os.listdir(merged_path))
        else:
            merged_files = set()
        
        # Only process unmerged files
        file_list = [f for f in all_combined if f not in merged_files]
    
    results = []
    
    for file in file_list:
        try:
            with open(f"{data_dir}/combined/{file}") as f:
                combined = json.load(f)
                merged, conflicts = merge(combined)
                
                os.makedirs(f"{data_dir}/merged", exist_ok=True)
                with open(f"{data_dir}/merged/{file}", "w") as f:
                    json.dump(merged, f, indent=4)
                
                os.makedirs(f"{data_dir}/conflicts", exist_ok=True)
                with open(f"{data_dir}/conflicts/{file}", "w") as f:
                    json.dump(conflicts, f, indent=4)
                
                results.append({
                    "file": file,
                    "status": "success",
                    "merged_count": len(merged),
                    "conflicts_count": len(conflicts)
                })
        except Exception as e:
            results.append({
                "file": file,
                "status": "error",
                "error": str(e)
            })
    
    return results