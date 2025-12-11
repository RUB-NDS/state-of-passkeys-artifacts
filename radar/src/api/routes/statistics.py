import os
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict
from fastapi import APIRouter, HTTPException
import pandas as pd

from src.api.models import TemporalStatistic, DirectoryStatisticsResponse, DirectoryStatistic
from src.helpers import get_all_ids
from src.api.cache import cache_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/statistics", tags=["statistics"])
DATA_DIR = os.getenv("DATA_DIR", "../data")


@router.get("/temporal")
async def get_temporal_statistics(limit: int = 100):
    """Get domain count over time using merged data"""
    all_merged = sorted(get_all_ids(f"{DATA_DIR}/merged"))
    total_count = len(all_merged)

    if not all_merged:
        return {"total_count": 0, "displayed_count": 0, "data": []}

    # Sample if too many files
    if len(all_merged) > limit:
        step = len(all_merged) // limit
        sampled = all_merged[::step]
        if all_merged[-1] not in sampled:
            sampled.append(all_merged[-1])
        all_merged = sampled

    stats = []
    for date_id in all_merged:
        try:
            with open(f"{DATA_DIR}/merged/{date_id}.json") as f:
                data = json.load(f)
                stats.append(TemporalStatistic(
                    date=date_id,
                    total_domains=len(data),
                    timestamp=datetime.strptime(date_id, "%Y-%m-%d-%H-%M-%S").isoformat()
                ))
        except Exception as e:
            print(f"Error reading {date_id}: {e}")

    return {
        "total_count": total_count,
        "displayed_count": len(stats),
        "data": stats
    }


@router.get("/directory", response_model=DirectoryStatisticsResponse)
async def get_directory_statistics() -> DirectoryStatisticsResponse:
    """Get per-directory statistics for the latest merged data"""
    # Get latest merged file
    all_merged = sorted(get_all_ids(f"{DATA_DIR}/merged"))
    if not all_merged:
        raise HTTPException(status_code=404, detail="No merged data available")

    latest = all_merged[-1]
    merged_path = f"{DATA_DIR}/merged/{latest}.json"

    with open(merged_path) as f:
        merged_data = json.load(f)

    stats = []

    # Count entries per directory in merged data
    directory_counts = {}
    wellknown_counts = {}

    # merged_data is a list of entries
    for entry in merged_data:
        # Count directories dynamically
        if "directories" in entry and isinstance(entry["directories"], dict):
            for dir_key in entry["directories"]:
                directory_counts[dir_key] = directory_counts.get(dir_key, 0) + 1

        # Count wellknown dynamically
        if "wellknown" in entry and isinstance(entry["wellknown"], dict):
            for wk_type in entry["wellknown"]:
                wellknown_counts[wk_type] = wellknown_counts.get(wk_type, 0) + 1

    # Build statistics for all found directories
    for directory, count in sorted(directory_counts.items()):
        stats.append(DirectoryStatistic(
            directory=directory,
            name=directory,  # Use directory name as display name
            count=count
        ))

    # Wellknown statistics for all found types
    for wellknown_type, count in sorted(wellknown_counts.items()):
        stats.append(DirectoryStatistic(
            directory=f"wellknown_{wellknown_type}",
            name=f"Well-known {wellknown_type}",
            count=count
        ))

    return DirectoryStatisticsResponse(date=latest, statistics=stats)


@router.get("/history")
async def get_history():
    """Get historical statistics from merged data"""
    all_merged = sorted(get_all_ids(f"{DATA_DIR}/merged"))

    if not all_merged:
        raise HTTPException(status_code=404, detail="No merged data available")

    history_data = []

    for date_id in all_merged:
        try:
            merged_path = f"{DATA_DIR}/merged/{date_id}.json"
            with open(merged_path) as f:
                merged_data = json.load(f)

                # Count entries per directory/wellknown
                directory_counts = {}

                # merged_data is a list of passkey-enabled entries
                for entry in merged_data:
                    # Count directories
                    if "directories" in entry and isinstance(entry["directories"], dict):
                        for dir_key in entry["directories"]:
                            directory_counts[dir_key] = directory_counts.get(dir_key, 0) + 1

                    # Count wellknown
                    if "wellknown" in entry and isinstance(entry["wellknown"], dict):
                        for wk_type in entry["wellknown"]:
                            key = f"wellknown_{wk_type}"
                            directory_counts[key] = directory_counts.get(key, 0) + 1

                history_data.append({
                    "date": date_id,
                    "timestamp": datetime.strptime(date_id, "%Y-%m-%d-%H-%M-%S").isoformat(),
                    "directories": directory_counts
                })
        except Exception as e:
            print(f"Error processing {date_id}: {e}")
            continue

    return history_data


@router.get("/directory-growth")
async def get_directory_growth():
    """Get growth data for each directory over time with special handling for certain directories"""

    # Use cache for this expensive operation
    cache_key = "directory_growth"

    # Try to get from cache first
    cached_data = cache_service.get(cache_key)
    if cached_data is not None:
        logger.info("Serving directory-growth from cache")
        return cached_data

    # If not in cache, compute it and cache the result
    logger.info("Computing directory-growth (not in cache)")
    result = _compute_directory_growth()

    # Cache the result with TTL of 2 hours (longer than refresh interval)
    cache_service.set(cache_key, result, ttl_seconds=7200)
    logger.info("Cached directory-growth result")

    return result


def _compute_directory_growth():
    """Internal function to compute directory growth data"""
    directories_path = f"{DATA_DIR}/directories"
    wellknown_path = f"{DATA_DIR}/wellknown"

    if not os.path.exists(directories_path):
        raise HTTPException(status_code=404, detail="Directories data not found")

    # Prepare a list to hold data from all subdirectories
    all_subdir_data = []

    # Special directories that track creation dates
    SPECIAL_DIRS = ["passkeys.directory", "enpass.io", "fidoalliance.org"]

    # First, process directories
    for sub_name in os.listdir(directories_path):
        sub_path = os.path.join(directories_path, sub_name)

        # Handle dashlane rename
        display_name = "dashlane.com" if sub_name == "passkeys-directory.dashlane.com" else sub_name

        if not os.path.isdir(sub_path):
            continue

        # Special case for directories that track creation dates
        if sub_name in SPECIAL_DIRS:
            # Find the most recent file
            most_recent_file = None
            most_recent_ts = None

            for filename in os.listdir(sub_path):
                if not filename.endswith(".json"):
                    continue

                base_name = filename[:-5]  # remove ".json"
                try:
                    ts = datetime.strptime(base_name, "%Y-%m-%d-%H-%M-%S")
                except ValueError:
                    continue

                if most_recent_ts is None or ts > most_recent_ts:
                    most_recent_ts = ts
                    most_recent_file = filename

            if most_recent_file:
                file_path = os.path.join(sub_path, most_recent_file)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data_array = json.load(f)
                except (json.JSONDecodeError, FileNotFoundError):
                    continue

                # Collect creation dates
                creation_dates = []

                for item in data_array:
                    if sub_name == "passkeys.directory":
                        # Only count items with passkey support
                        if not (item.get("passkey_signin") or item.get("passkey_mfa")):
                            continue
                        # The creation field is "created_at" (ISO 8601)
                        created_str = item.get("created_at")
                        if not created_str:
                            continue
                        # Convert any trailing "Z" to "+00:00"
                        created_str = created_str.replace("Z", "+00:00")
                        try:
                            created_dt = datetime.fromisoformat(created_str)
                            creation_dates.append(created_dt.date())
                        except ValueError:
                            continue

                    elif sub_name == "enpass.io":
                        # The creation field is "created_date" (epoch time as string)
                        created_str = item.get("created_date")
                        if not created_str:
                            continue
                        try:
                            epoch_val = int(created_str)
                            # Convert to UTC datetime
                            created_dt = datetime.fromtimestamp(epoch_val, tz=timezone.utc)
                            creation_dates.append(created_dt.date())
                        except ValueError:
                            continue

                    else:  # fidoalliance.org
                        # The creation field is "post_date" (epoch time as string)
                        created_str = item.get("post_date")
                        if not created_str:
                            continue
                        try:
                            epoch_val = int(created_str)
                            created_dt = datetime.fromtimestamp(epoch_val, tz=timezone.utc)
                            creation_dates.append(created_dt.date())
                        except ValueError:
                            continue

                # Create cumulative counts by date
                if creation_dates:
                    creation_series = pd.Series(creation_dates)
                    daily_counts = creation_series.value_counts().sort_index()

                    df_special = pd.DataFrame({
                        "date": daily_counts.index,
                        "daily_new": daily_counts.values
                    }).sort_values("date")

                    # Compute cumulative total
                    df_special["count"] = df_special["daily_new"].cumsum()
                    df_special = df_special[["date", "count"]]
                    df_special["type"] = display_name

                    all_subdir_data.append(df_special.to_dict("records"))

            continue

        # Normal case for other directories
        daily_data = {}

        for filename in os.listdir(sub_path):
            if not filename.endswith(".json"):
                continue

            base_name = filename[:-5]
            try:
                ts = datetime.strptime(base_name, "%Y-%m-%d-%H-%M-%S")
            except ValueError:
                continue

            file_path = os.path.join(sub_path, filename)

            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data_array = json.load(f)
            except (json.JSONDecodeError, FileNotFoundError):
                continue

            # Special counting for 2fa.directory
            if sub_name == "2fa.directory":
                count_items = len([c for c in data_array if "tfa" in c and "u2f" in c["tfa"]])
            else:
                count_items = len(data_array)

            # Skip if too few items
            if count_items < 5:
                continue

            day = ts.date()

            # Keep earliest timestamp per day
            if day not in daily_data:
                daily_data[day] = (ts, count_items)
            else:
                existing_ts, existing_count = daily_data[day]
                if ts < existing_ts:
                    daily_data[day] = (ts, count_items)

        # Build data for this directory
        if daily_data:
            sorted_days = sorted(daily_data.keys())
            subdir_data = [
                {
                    "date": day.isoformat(),
                    "count": daily_data[day][1],
                    "type": display_name
                }
                for day in sorted_days
            ]
            all_subdir_data.append(subdir_data)

    # Process well-known directories
    if os.path.exists(wellknown_path):
        for wellknown_type in ["webauthn", "endpoints"]:
            type_path = os.path.join(wellknown_path, wellknown_type)
            if not os.path.isdir(type_path):
                continue

            daily_data = {}

            for filename in os.listdir(type_path):
                if not filename.endswith(".json"):
                    continue

                base_name = filename[:-5]
                try:
                    ts = datetime.strptime(base_name, "%Y-%m-%d-%H-%M-%S")
                except ValueError:
                    continue

                file_path = os.path.join(type_path, filename)

                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        data_array = json.load(f)
                except (json.JSONDecodeError, FileNotFoundError):
                    continue

                count_items = len(data_array)

                # Don't skip well-known even if few items
                day = ts.date()

                # Keep earliest timestamp per day
                if day not in daily_data:
                    daily_data[day] = (ts, count_items)
                else:
                    existing_ts, existing_count = daily_data[day]
                    if ts < existing_ts:
                        daily_data[day] = (ts, count_items)

            # Build data for this well-known type
            if daily_data:
                sorted_days = sorted(daily_data.keys())
                wellknown_data = [
                    {
                        "date": day.isoformat(),
                        "count": daily_data[day][1],
                        "type": f"Well-known {wellknown_type.capitalize()}"
                    }
                    for day in sorted_days
                ]
                all_subdir_data.append(wellknown_data)

    # Flatten all data
    flattened_data = []
    for subdir_list in all_subdir_data:
        flattened_data.extend(subdir_list)

    if not flattened_data:
        return {"data": [], "directories": []}

    # Convert to DataFrame for easier processing
    df = pd.DataFrame(flattened_data)
    df["date"] = pd.to_datetime(df["date"])

    # Get global date range
    min_date = df["date"].min()
    max_date = df["date"].max()
    all_dates = pd.date_range(start=min_date, end=max_date, freq="D")

    # Forward-fill missing days for each directory
    result_data = []

    for directory_type in df["type"].unique():
        df_dir = df[df["type"] == directory_type].copy()
        df_dir = df_dir.sort_values("date")
        df_dir = df_dir.set_index("date")

        # Reindex to include all dates
        df_dir = df_dir.reindex(all_dates)

        # Forward fill counts
        df_dir["count"] = df_dir["count"].ffill()
        df_dir["type"] = directory_type

        # Convert back to records
        df_dir = df_dir.reset_index()
        df_dir.columns = ["date", "count", "type"]

        # Filter out NaN rows and convert to dict
        df_dir = df_dir.dropna()
        records = df_dir.to_dict("records")

        # Convert date back to string
        for record in records:
            record["date"] = record["date"].strftime("%Y-%m-%d")

        result_data.extend(records)

    # Get unique directory types
    directories = sorted(df["type"].unique())

    return {
        "data": result_data,
        "directories": directories
    }
