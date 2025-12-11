import os
import json
import pickle
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional, Callable
import logging

logger = logging.getLogger(__name__)

class CacheService:
    """Simple disk-based cache with background refresh"""

    def __init__(self, cache_dir: str = None):
        # Use /tmp for cache storage for better performance
        self.cache_dir = Path(cache_dir or "/tmp/radar_cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.refresh_threads = {}
        self.locks = {}

    def _get_cache_path(self, key: str) -> Path:
        """Get the cache file path for a given key"""
        return self.cache_dir / f"{key}.pkl"

    def _get_metadata_path(self, key: str) -> Path:
        """Get the metadata file path for a given key"""
        return self.cache_dir / f"{key}.meta.json"

    def get(self, key: str) -> Optional[Any]:
        """Get cached value if it exists and is valid"""
        cache_path = self._get_cache_path(key)
        meta_path = self._get_metadata_path(key)

        if not cache_path.exists() or not meta_path.exists():
            return None

        try:
            with open(meta_path, "r") as f:
                metadata = json.load(f)

            # Check if cache is still valid
            expires_at = datetime.fromisoformat(metadata["expires_at"])
            if datetime.now() > expires_at:
                return None

            with open(cache_path, "rb") as f:
                return pickle.load(f)
        except Exception as e:
            logger.error(f"Error reading cache for {key}: {e}")
            return None

    def set(self, key: str, value: Any, ttl_seconds: int):
        """Set a cache value with TTL"""
        cache_path = self._get_cache_path(key)
        meta_path = self._get_metadata_path(key)

        try:
            # Save the value
            with open(cache_path, "wb") as f:
                pickle.dump(value, f)

            # Save metadata
            metadata = {
                "created_at": datetime.now().isoformat(),
                "expires_at": (datetime.now() + timedelta(seconds=ttl_seconds)).isoformat(),
                "ttl_seconds": ttl_seconds
            }
            with open(meta_path, "w") as f:
                json.dump(metadata, f)
        except Exception as e:
            logger.error(f"Error writing cache for {key}: {e}")

    def get_or_compute(self, key: str, compute_fn: Callable, ttl_seconds: int = 3600) -> Any:
        """Get cached value or compute it if not cached"""
        # Try to get from cache first
        cached = self.get(key)
        if cached is not None:
            return cached

        # Compute the value
        value = compute_fn()

        # Cache it
        self.set(key, value, ttl_seconds)

        return value

    def start_background_refresh(self, key: str, compute_fn: Callable, refresh_interval_seconds: int = 3600):
        """Start a background thread that refreshes the cache periodically"""

        # Stop any existing refresh thread for this key
        self.stop_background_refresh(key)

        # Create a lock for this key
        if key not in self.locks:
            self.locks[key] = threading.Lock()

        def refresh_worker():
            while key in self.refresh_threads:
                try:
                    # Compute new value
                    logger.info(f"Refreshing cache for {key}")
                    new_value = compute_fn()

                    # Update cache atomically
                    with self.locks[key]:
                        self.set(key, new_value, refresh_interval_seconds * 2)  # Set TTL to 2x refresh interval as safety

                    logger.info(f"Successfully refreshed cache for {key}")
                except Exception as e:
                    logger.error(f"Error refreshing cache for {key}: {e}")

                # Sleep for the refresh interval
                time.sleep(refresh_interval_seconds)

        # Start the background thread
        thread = threading.Thread(target=refresh_worker, daemon=True)
        self.refresh_threads[key] = thread
        thread.start()

        # Do an initial population if cache doesn't exist
        if self.get(key) is None:
            try:
                logger.info(f"Initial cache population for {key}")
                value = compute_fn()
                with self.locks[key]:
                    self.set(key, value, refresh_interval_seconds * 2)
            except Exception as e:
                logger.error(f"Error during initial cache population for {key}: {e}")

    def stop_background_refresh(self, key: str):
        """Stop the background refresh thread for a key"""
        if key in self.refresh_threads:
            del self.refresh_threads[key]

# Global cache instance
cache_service = CacheService()
