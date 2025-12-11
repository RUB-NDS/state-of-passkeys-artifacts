import os
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

from src.api.auth import get_current_admin
from src.api.routes import data, operations, statistics, admin
from src.api.cache import cache_service
from src.api.routes.statistics import _compute_directory_growth

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# Get DATA_DIR from environment
DATA_DIR = os.getenv("DATA_DIR", "../data")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    # Startup
    logger.info("Starting up Passkey Radar API")

    # Initialize background cache refresh for directory-growth endpoint
    # Refresh every hour (3600 seconds)
    cache_service.start_background_refresh(
        key="directory_growth",
        compute_fn=_compute_directory_growth,
        refresh_interval_seconds=3600
    )
    logger.info("Started background cache refresh for directory-growth endpoint")

    yield

    # Shutdown
    logger.info("Shutting down Passkey Radar API")
    cache_service.stop_background_refresh("directory_growth")


# FastAPI app initialization
app = FastAPI(
    title="Passkey Radar API",
    description="API for aggregating and analyzing passkey adoption across directories",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(operations.router)
app.include_router(data.router)
app.include_router(statistics.router)
app.include_router(admin.router)


# Root routes
@app.get("/")
async def read_root():
    """Serve the main web interface"""
    return FileResponse("src/static/index.html")


@app.get("/data/{file_path:path}")
async def serve_data_file(file_path: str):
    """Serve data files for viewing"""
    import json

    # Construct the full path
    full_path = Path(DATA_DIR) / file_path

    # Security check - ensure the path is within DATA_DIR
    try:
        full_path = full_path.resolve()
        Path(DATA_DIR).resolve()
        if not str(full_path).startswith(str(Path(DATA_DIR).resolve())):
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        raise HTTPException(status_code=403, detail="Access denied")

    # Check if file exists
    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    # Only serve JSON files
    if full_path.suffix != '.json':
        raise HTTPException(status_code=403, detail="Only JSON files can be accessed")

    # Return the file
    return FileResponse(full_path, media_type="application/json")




# Mount static files
if os.path.exists("src/static"):
    app.mount("/static", StaticFiles(directory="src/static"), name="static")


# Create directories if they don't exist
for directory in ["src/static", "src/static/css", "src/static/js", "src/templates"]:
    os.makedirs(directory, exist_ok=True)


# Create data directory if specified
os.makedirs(DATA_DIR, exist_ok=True)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8090)
