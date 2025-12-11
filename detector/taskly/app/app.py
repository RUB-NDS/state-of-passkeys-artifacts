from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from routers import ping, scans, tags, tasks, views, indexes


# fastapi
app = FastAPI(
    title="Taskly",
    version="0.0.1"
)

# routers
app.include_router(indexes.router)
app.include_router(ping.router)
app.include_router(scans.router)
app.include_router(tags.router)
app.include_router(tasks.router)
app.include_router(views.router)

# static files
app.mount("/static", StaticFiles(directory="static"), name="static")
