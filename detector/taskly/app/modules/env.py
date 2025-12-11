import os


env = {
    # general
    "LOG_LEVEL": os.environ.get("LOG_LEVEL", "INFO"),
    "TASKS_DIR": os.environ.get("TASKS_DIR", "tasks"),
    "TMP_PATH": os.environ.get("TMP_PATH", "/tmp"),
    "CHECK_CERTS": bool(int(os.environ.get("CHECK_CERTS", "0"))),

    # worker
    "WORKER_CONCURRENCY": int(os.environ.get("WORKER_CONCURRENCY", "1")),
    "WORKER_PREFETCH": int(os.environ.get("WORKER_PREFETCH", "1")),

    # auth
    "GUEST_USER": os.environ.get("GUEST_USER", "guest"),
    "GUEST_PASS": os.environ.get("GUEST_PASS", "changeme"),
    "ADMIN_USER": os.environ.get("ADMIN_USER", "admin"),
    "ADMIN_PASS": os.environ.get("ADMIN_PASS", "changeme"),

    # external domains
    "TRAEFIK_EXTERNAL_DOMAIN": os.environ.get("TRAEFIK_EXTERNAL_DOMAIN", "traefik.docker.localhost"),
    "MOCK_EXTERNAL_DOMAIN": os.environ.get("MOCK_EXTERNAL_DOMAIN", "mock.docker.localhost"),
    "BRAIN_EXTERNAL_DOMAIN": os.environ.get("BRAIN_EXTERNAL_DOMAIN", "brain.docker.localhost"),
    "RABBITMQ_EXTERNAL_DOMAIN": os.environ.get("RABBITMQ_EXTERNAL_DOMAIN", "rabbitmq.docker.localhost"),
    "MONGO_EXTERNAL_DOMAIN": os.environ.get("MONGO_EXTERNAL_DOMAIN", "mongo.docker.localhost"),
    "MONGOEXPRESS_EXTERNAL_DOMAIN": os.environ.get("MONGOEXPRESS_EXTERNAL_DOMAIN", "mongoexpress.docker.localhost"),
    "MINIO_ADMIN_EXTERNAL_DOMAIN": os.environ.get("MINIO_ADMIN_EXTERNAL_DOMAIN", "minio-admin.docker.localhost"),
    "MINIO_RAW_EXTERNAL_DOMAIN": os.environ.get("MINIO_RAW_EXTERNAL_DOMAIN", "minio-raw.docker.localhost"),
    "SEARXNG_EXTERNAL_DOMAIN": os.environ.get("SEARXNG_EXTERNAL_DOMAIN", "searxng.docker.localhost"),
    "JUPYTER_EXTERNAL_DOMAIN": os.environ.get("JUPYTER_EXTERNAL_DOMAIN", "jupyter.docker.localhost"),
    "METABASE_EXTERNAL_DOMAIN": os.environ.get("METABASE_EXTERNAL_DOMAIN", "metabase.docker.localhost"),

    # rabbitmq
    "RABBITMQ_HOST": os.environ.get("RABBITMQ_HOST", "rabbitmq"),
    "RABBITMQ_PORT": os.environ.get("RABBITMQ_PORT", "5672"),
    "RABBITMQ_TLS": bool(int(os.environ.get("RABBITMQ_TLS", "0"))),

    # mongo
    "MONGO_HOST": os.environ.get("MONGO_HOST", "mongo"),
    "MONGO_PORT": os.environ.get("MONGO_PORT", "27017"),
    "MONGO_TLS": bool(int(os.environ.get("MONGO_TLS", "0"))),

    # minio
    "MINIO_HOST": os.environ.get("MINIO_HOST", "minio"),
    "MINIO_PORT": os.environ.get("MINIO_PORT", "9000"),
    "MINIO_TLS": bool(int(os.environ.get("MINIO_TLS", "0"))),

    # searxng
    "SEARXNG_HOST": os.environ.get("SEARXNG_HOST", "searxng"),
    "SEARXNG_PORT": os.environ.get("SEARXNG_PORT", "8080"),
    "SEARXNG_TLS": bool(int(os.environ.get("SEARXNG_TLS", "0"))),
}
