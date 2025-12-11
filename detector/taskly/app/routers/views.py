from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates
from modules.env import env
from modules.tasks import load


router = APIRouter(prefix="", include_in_schema=False)
templates = Jinja2Templates(directory="templates")


@router.get("/")
def index(request: Request):
    context = {"env": env, "task_names": [t[0] for t in load()]}
    return templates.TemplateResponse(request, "index.html", context)
