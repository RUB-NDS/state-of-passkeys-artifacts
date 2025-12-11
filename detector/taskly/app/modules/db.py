from minio import Minio
from pymongo import MongoClient, ASCENDING, DESCENDING
from modules.env import env


mongo = MongoClient(
    f"mongodb://{env['ADMIN_USER']}:{env['ADMIN_PASS']}@{env['MONGO_HOST']}:{env['MONGO_PORT']}",
    tls=True if env["MONGO_TLS"] else False,
    tlsAllowInvalidCertificates=False if env["CHECK_CERTS"] else True
)


minio = Minio(
    endpoint=f"{env['MINIO_HOST']}:{env['MINIO_PORT']}",
    access_key=env["ADMIN_USER"],
    secret_key=env["ADMIN_PASS"],
    secure=True if env["MINIO_TLS"] else False,
    cert_check=True if env["CHECK_CERTS"] else False
)


tasks = mongo["tasks"]
tags = mongo["settings"]["tags"]


indexes = [
    [("args.1", ASCENDING)],
    [("args.1", ASCENDING), ("date_done", ASCENDING)],
    [("args.1", ASCENDING), ("date_done", DESCENDING)],
    [("args.1", ASCENDING), ("status", ASCENDING)],
]
