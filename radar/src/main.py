import os
import typer
import logging
from tqdm import tqdm
from enum import Enum
from typing import List, Optional
from typing_extensions import Annotated
from src.directories import Directories
from src.core.fetch import fetch_directories
from src.core.combine import combine_data
from src.core.merge_data import merge_data


app = typer.Typer()


class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


@app.callback()
def log_level(verbosity: LogLevel = LogLevel.INFO):
    logging.basicConfig(level=getattr(logging, verbosity))


@app.command(name="fetch")
def cmd_fetch(directories: Annotated[List[Directories], typer.Option()] = list(Directories)):
    """Fetch data from passkey directories"""
    data_dir = os.getenv("DATA_DIR", "../data")
    results = fetch_directories(directories, data_dir)

    for result in tqdm(results):
        if result["status"] == "success":
            typer.echo(f"✓ {result['directory']}: {result['entries']} entries")
        else:
            typer.echo(f"✗ {result['directory']}: {result['error']}")


@app.command(name="combine")
def cmd_combine():
    """Combine data from all sources"""
    data_dir = os.getenv("DATA_DIR", "../data")
    result = combine_data(None, data_dir)
    typer.echo(f"✓ Combined {result['combined_files']} files")


@app.command(name="merge")
def cmd_merge(file: Optional[str] = None):
    """Merge combined data files"""
    data_dir = os.getenv("DATA_DIR", "../data")
    results = merge_data(file, data_dir)

    for result in tqdm(results):
        if result["status"] == "success":
            typer.echo(f"✓ {result['file']}: {result['merged_count']} merged, {result['conflicts_count']} conflicts")
        else:
            typer.echo(f"✗ {result['file']}: {result['error']}")


if __name__ == "__main__":
    app()
