The well-known detector uses [Taskly](./taskly/) as its parallel-execution framework. Taskly distributes scan tasks across isolated Docker workers via a RabbitMQ message queue, stores results in MongoDB, and keeps large files in MinIO S3 object storage. See the [Taskly README](./taskly/README.md) for general framework documentation.

This guide covers two deployment modes for running the well-known detector:
1. **[CLI mode](#cli-mode)** — sequential execution on a single machine, no infrastructure needed
2. **[Parallel mode](#parallel-mode)** — distributed execution across multiple workers with full infrastructure

## CLI Mode

Run tasks locally without the full Taskly infrastructure. Tasks execute sequentially and results are stored on the local filesystem. Useful for testing or small-scale scans.

### Build

```bash
docker build -t taskly-worker -f taskly/app/Dockerfile.worker taskly/app
```

### Run

Show available commands:

```bash
docker run --rm -it -v $(pwd)/tasks:/app/tasks -v $(pwd)/output:/output -e TASKS_DIR=/app/tasks taskly-worker python cli.py --help
```

### Schedule Wellknown Task

The `schedule_wellknown` command schedules tasks based on a scan configuration. It probes a broad set of well-known URIs (e.g., `openid-configuration`, `oauth-client`, `web-identity`, `jwks`, etc.) in addition to the passkey-related ones (`passkey-endpoints`, `webauthn`, `fido-configuration`, `fido2-configuration`). Only the passkey-related results are used in the paper; the remaining endpoints were collected for exploratory purposes and are not part of the analysis.

```bash
docker run --rm -it -v $(pwd)/tasks:/app/tasks -v $(pwd)/output:/output -e TASKS_DIR=/app/tasks taskly-worker python cli.py schedule_wellknown [OPTIONS]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--out TEXT` | Output directory | `/tmp` |
| `--scan-config.type [origin\|crux\|tranco]` | Source type | `origin` |
| `--scan-config.origin TEXT` | Single origin to scan | `https://example.com` |
| `--scan-config.crux-yyyymm TEXT` | CrUX dataset month | `202501` |
| `--scan-config.tranco-yyyymmdd TEXT` | Tranco dataset date | `20250101` |
| `--scan-config.max-rank INT` | Max rank to scan | `1000` |
| `--analysis-config.origin TEXT` | Origin for analysis | `https://example.com` |
| `--analysis-config.rank INT` | Rank for analysis | |

**Examples:**

Scan a single origin:

```bash
docker run --rm -it -v $(pwd)/tasks:/app/tasks -v $(pwd)/output:/output -e TASKS_DIR=/app/tasks taskly-worker python cli.py schedule_wellknown --out /output --scan-config.type origin --scan-config.origin https://www.kayak.com
```

Scan top 1000 from CrUX list:

```bash
docker run --rm -it -v $(pwd)/tasks:/app/tasks -v $(pwd)/output:/output -e TASKS_DIR=/app/tasks taskly-worker python cli.py schedule_wellknown --out /output --scan-config.type crux --scan-config.max-rank 1000
```

## Parallel Mode

Deploy the full Taskly infrastructure for distributed scanning across multiple workers. This is the mode used in the paper to scan 18M CrUX domains.

### Architecture

```
                       ┌─────────────┐
                       │    Brain    │ :8000 — Web UI & API
                       └──────┬──────┘
                              │
                       ┌──────▼──────┐
                       │  RabbitMQ   │ :5672 — Task queue
                       └──────┬──────┘
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Worker 1 │   │ Worker 2 │   │ Worker N │
        └──────────┘   └──────────┘   └──────────┘
              │               │               │
              └───────────────┼───────────────┘
                              ▼
              ┌──────────────────────────────┐
              │  MongoDB :27017  │  MinIO :9000  │
              └──────────────────────────────┘
```

- **Brain** — FastAPI web interface for submitting scans, monitoring progress, and managing tasks.
- **RabbitMQ** — Message queue that distributes individual origin scan tasks to workers.
- **Workers** — Isolated Docker containers that each execute scan tasks concurrently. Each worker probes one origin at a time per process.
- **MongoDB** — Stores all task results, metadata, and status information.
- **MinIO** — S3-compatible object storage for large result files referenced from MongoDB.

### 1. Start the Stack

From the `detector/` directory, start the full infrastructure with the custom tasks directory:

```bash
cd detector/taskly
TASKS_DIR=../tasks docker compose --profile production up --build
```

The `TASKS_DIR=../tasks` variable mounts the detector's task definitions (in `detector/tasks/`) into the containers, replacing Taskly's built-in example tasks.

Wait until all services are healthy. You can verify with:

```bash
docker compose ps
```

### 2. Access the Web Interfaces

Once the stack is running, the following interfaces are available:

| Service | URL | Credentials | Purpose |
|---------|-----|-------------|---------|
| Brain | `localhost:8000` | admin / changeme | Submit and manage scans |
| RabbitMQ | `localhost:15672` | admin / changeme | Monitor task queue |
| Mongo Express | `localhost:8081` | — | Browse MongoDB results |
| MinIO Console | `localhost:9090` | admin / changeme | Inspect stored files |
| Flower | `localhost:5555` | — | Monitor Celery workers (start separately, see below) |

Default credentials can be changed via environment variables (`ADMIN_USER`, `ADMIN_PASS`).

### 3. Submit a Scan

Open the Brain web interface at `localhost:8000`. The `wellknown` task will appear with its configuration form. Configure the scan:

- **Source type**: `crux` (CrUX dataset), `tranco` (Tranco list), or `origin` (single domain)
- **Dataset identifier**: e.g., CrUX month `202501` or Tranco date `20250101`
- **Max rank**: limits the scan to the top N domains (e.g., `1000`)

Submit the scan. The brain generates one task per origin and dispatches them to RabbitMQ. Workers pick up tasks from the queue and execute them in parallel.

### 4. Scale Workers

By default, the stack starts a single worker. For large-scale scans, scale the worker count:

```bash
cd detector/taskly
TASKS_DIR=../tasks QUEUE=default docker compose --profile production up worker --build --scale worker=10
```

Each worker runs one process by default. Adjust concurrency per worker with environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `WORKER_CONCURRENCY` | Processes per worker container | `1` |
| `WORKER_PREFETCH` | Tasks prefetched per process | `1` |

For example, to run 10 workers with 2 processes each (20 concurrent tasks total):

```bash
TASKS_DIR=../tasks QUEUE=default WORKER_CONCURRENCY=2 docker compose --profile production up worker --build --scale worker=10
```

### 5. Monitor Progress

- **Brain UI** (`localhost:8000`) — Shows per-scan task counts by status (started, success, failure, retry).
- **RabbitMQ UI** (`localhost:15672`) — Shows queue depth and message rates.
- **Flower** — Start the Flower monitoring service for detailed worker and task introspection:

```bash
cd detector/taskly
TASKS_DIR=../tasks docker compose up flower --build
```

Then open `localhost:5555`.

### 6. Handle Failures

Taskly automatically retries failed tasks up to 3 times. After all retries are exhausted, failed tasks can be rescanned via the Brain API:

```
PUT localhost:8000/scans?task_name=wellknown&scan_id=<scan_id>
```

This resubmits all failed tasks from the given scan to the queue.

### 7. Access Results

Scan results are stored in MongoDB under the `tasks` database. Each task result contains:

- **args** — The task name, scan ID, task ID, and all configuration objects
- **result** — A dictionary with one entry per probed well-known URI, each containing `{success, error, data}`
- **status** — `SUCCESS`, `FAILURE`, `RETRY`, or `STARTED`

Browse results interactively via Mongo Express (`localhost:8081`) or query MongoDB directly:

```bash
# Connect to MongoDB
docker exec -it taskly-mongo-1 mongosh -u admin -p changeme

# Switch to the tasks database
use tasks

# Count successful results for a scan
db.celery_taskmeta.countDocuments({"args.0": "wellknown", "status": "SUCCESS"})

# Find passkey-endpoints results
db.celery_taskmeta.find({"args.0": "wellknown", "result.passkey_endpoints.success": true})
```

Large file references in results point to MinIO objects and can be accessed via the MinIO Console (`localhost:9090`).

### 8. Persistent Storage

By default, all data is stored under `/tmp/taskly/`. Set the `DATA` environment variable to change the storage location:

```bash
DATA=/mnt/data TASKS_DIR=../tasks docker compose --profile production up --build
```

This affects MongoDB data, MinIO objects, RabbitMQ state, and Traefik logs/certificates.

### 9. Shut Down

Stop the stack while preserving data:

```bash
docker compose --profile production down
```

Remove all data volumes:

```bash
docker compose --profile production down -v
rm -rf ${DATA:-/tmp/taskly}
```
