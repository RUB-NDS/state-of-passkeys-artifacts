from ssl import CERT_NONE
from celery import Celery
from kombu.serialization import register
from modules.env import env


celery = Celery("celery")


register(
    "mongodb",
    lambda obj: obj,
    lambda obj: obj,
    content_type="application/mongo-json",
    content_encoding="utf-8"
)


celery.config_from_object({
    # broker
    "broker_url": f"amqp{'s' if env['RABBITMQ_TLS'] else ''}://{env['ADMIN_USER']}:{env['ADMIN_PASS']}@{env['RABBITMQ_HOST']}:{env['RABBITMQ_PORT']}",
    "broker_use_ssl": {"cert_reqs": CERT_NONE} if env["RABBITMQ_TLS"] else False, # TODO: verify cert if env["CHECK_CERTS"] is true
    "broker_connection_retry_on_startup": True,

    # backend
    "result_backend": f"mongodb://{env['ADMIN_USER']}:{env['ADMIN_PASS']}@{env['MONGO_HOST']}:{env['MONGO_PORT']}",
    "mongodb_backend_settings": {
        "database": "tasks",
        "options": {
            "tls": True if env["MONGO_TLS"] else False,
            "tlsAllowInvalidCertificates": False if env["CHECK_CERTS"] else True
        }
    },
    "override_backends": {
        "mongodb": "modules.backend.CollectionMongoBackend"
    },

    # worker
    "worker_concurrency": env["WORKER_CONCURRENCY"], # number of processes per worker
    "worker_prefetch_multiplier": env["WORKER_PREFETCH"], # number of tasks to prefetch per process

    # result
    "result_backend_always_retry": True, # retry connecting to result backend
    "result_expires": 0, # never expire task results
    "result_extended": True, # store name, args, kwargs, worker, retries, queue, delivery_info
    "result_serializer": "mongodb", # store task results in mongodb as json and not strings

    # task
    "task_acks_late": True, # acknowledge task after task is complete (make sure task is idempotent)
    "task_ignore_result": False, # always store task result
    "task_store_errors_even_if_ignored": True, # store task errors even if task result not stored
    "task_track_started": True, # enable status 'started' when the task is executed
    "task_max_retries": 3, # retry failed tasks 3 times
    "task_time_limit": 3*60*60, # kill tasks that take longer than 3 hours
})


celery.autodiscover_tasks(["modules.tasks"])
