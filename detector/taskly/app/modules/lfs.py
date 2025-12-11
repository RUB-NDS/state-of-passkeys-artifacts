import os
import json
import base64
from io import BytesIO
from uuid import uuid4
from nested_lookup import nested_alter
from modules.db import minio
from modules.logging import get_logger


logger = get_logger(__name__)


def find_parent_key(data: dict|list, target_key: str, target_value: str, prior_key: None|str = None, results: None|list = None) -> list:
    """ Find parent key of a target key-value pair in a nested dict or list.
        Example: find_parent_key(input, "typ", "data")
        Input: {"foo": {"typ": "data", ...}, "bar": {"typ": "data", ...}}
        Output: ["foo", "bar"]
    """
    if results is None:
        results = []
    if isinstance(data, dict):
        for k, v in data.items():
            if prior_key and k == target_key and v == target_value:
                results.append(prior_key)
            else:
                find_parent_key(v, target_key, target_value, k, results)
    elif isinstance(data, list):
        for d in data:
            find_parent_key(d, target_key, target_value, None, results)
    return results


def decode(data: any, ext: str) -> tuple[bytes, str]:
    if ext == "png":
        return base64.b64decode(data), "image/png"
    elif ext == "json":
        return json.dumps(data).encode(), "application/json"
    elif ext == "txt":
        return data.encode(), "text/plain"
    else:
        raise Exception(f"Unsupported extension: {ext}")


def store_in_minio(task_name: str, scan_id: str, task_id: str, result: dict):
    """ Stores all files in minio and replaces them with references.
        Input: {"...": {"typ": "data", "ext": "png|json|txt|...", "data": ...}, ...}
        Output: {"...": {"typ": "ref", "ext": "png|json|txt|...", "ref": {"bucket": "...", "object": "..."}}, ...}
    """
    for k in list(set(find_parent_key(result, "typ", "data"))):
        def cb(d):
            if type(d) is not dict:
                return d

            typ = d.get("typ")
            ext = d.get("ext")
            data = d.get("data")
            if typ != "data" or not ext or not data:
                return d

            bucket = task_name
            object = f"/{scan_id}/{task_id}/{uuid4()}.{ext}"
            logger.debug(f"Storing data in minio: {bucket}:{object}")

            decoded, mime = decode(data, ext)
            if not minio.bucket_exists(bucket):
                minio.make_bucket(bucket)
            minio.put_object(bucket, object, BytesIO(decoded), -1, mime, part_size=50*1024*1024)

            return {"typ": "ref", "ext": ext, "ref": {"bucket": bucket, "object": object}}
        nested_alter(result, k, cb, in_place=True)


def delete_in_minio(result: dict):
    """ Deletes all files in minio from their references.
        Input: {"...": {"typ": "ref", "ext": "png|json|txt|...", "ref": {"bucket": "...", "object": "..."}}, ...}
    """
    for k in list(set(find_parent_key(result, "typ", "ref"))):
        def cb(d):
            if type(d) is not dict:
                return d

            typ = d.get("typ")
            ext = d.get("ext")
            ref = d.get("ref")
            if typ != "ref" or not ext or not ref:
                return d

            bucket = ref.get("bucket")
            object = ref.get("object")
            if not bucket or not object:
                return d
            logger.debug(f"Deleting data in minio: {bucket}:{object}")

            minio.remove_object(bucket, object)
            return None
        nested_alter(result, k, cb, in_place=True)


def store_in_filesystem(out: str, task_name: str, scan_id: str, task_id: str, result: dict):
    """ Stores all files in filesystem and replaces them with references.
        Input: {"...": {"typ": "data", "ext": "png|json|txt|...", "data": ...}, ...}
        Output: {"...": {"typ": "ref", "ext": "png|json|txt|...", "ref": {"path": "..."}}, ...}
    """
    for k in list(set(find_parent_key(result, "typ", "data"))):
        def cb(d):
            typ = d.get("typ")
            ext = d.get("ext")
            data = d.get("data")
            if typ != "data" or not ext or not data:
                return d

            path = f"/{task_name}/{scan_id}/{task_id}"
            file = f"/{uuid4()}.{ext}"
            logger.debug(f"Storing data in filesystem: {out}{path}{file}")

            decoded, mime = decode(data, ext)
            os.makedirs(f"{out}{path}", exist_ok=True)
            with open(f"{out}{path}{file}", "wb") as f:
                f.write(decoded)

            return {"typ": "ref", "ext": ext, "ref": {"path": f"{path}{file}"}}
        nested_alter(result, k, cb, in_place=True)
