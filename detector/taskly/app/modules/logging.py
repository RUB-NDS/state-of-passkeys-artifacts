import logging
import urllib3
from modules.env import env


log_level = getattr(logging, env["LOG_LEVEL"].upper())
log_format = "%(asctime)s:%(name)s:%(levelname)s:%(message)s"


logging.basicConfig(level=log_level, format=log_format)
logging.getLogger("werkzeug").setLevel(log_level)
urllib3.disable_warnings()


def get_logger(name: str):
    return logging.getLogger(name)
