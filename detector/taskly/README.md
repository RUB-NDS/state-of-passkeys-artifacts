# Taskly
Taskly is a scalable, extensible all-in-one framework for distributed parallel computing, data storage, and data analysis. It uses a central messaging queue to dispatch tasks across isolated workers, each running in its own Docker container. Tasks can be seamlessly created, configured, monitored, and deleted via an intuitive web interface, offering extensive configuration options to suit a wide range of use cases.

Workers are designed for resilience and can gracefully handle failures through integrated retry mechanisms and exception handling. Task results are stored in a MongoDB database, with the option to keep larger files in MinIO S3 object storage. An integrated Jupyter Notebook and Metabase Data Visualization Platform make it easy to inspect and analyze results directly within Taskly.

Originally developed for large-scale web measurements spanning millions of websites, Taskly comes pre-installed with essential tools such as the Playwright browser automation framework and the SearXNG Metasearch Engine, giving you a powerful, ready-to-use solution for robust data workflows.

## Requirements
- [Docker](https://docs.docker.com/get-started/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- Only for deployments w/out Docker: [Pipenv](https://pipenv.pypa.io/en/latest/installation.html)

## Quick Start
Taskly is entirely containerized with Docker, making it simple to spin up the entire suite of applications at once.
To get started, just run: `docker compose --profile production up --build`

### Components
When the stack is up and running, you'll see the following components available.
Open your browser and navigate to their respective URLs to begin using them.

- Web Interface available on `localhost:8000` - Configure new tasks, monitor running ones, and manage existing ones.
- MongoDB available on `localhost:8081` - Run custom MongoDB queries on your task results.
- RabbitMQ available on `localhost:15672` - Monitor and manage the central messaging queue.
- MinIO available on `localhost:9090` - Inspect and download large files that are stored in the object storage.
- SearXNG available on `localhost:8082` - Your own distributed search engine that doesn't rate limit and combines search results from multiple engines.
- Jupyter Notebook available on `localhost:8888` - Write Python notebooks that analyze your data in the MongoDB database and MinIO object storage.
- Metabase available on `localhost:3000` - Dashboard-style monitoring platform that can nicely depict statistics on the data in your MongoDB database.

## Add Your Own Custom Tasks
In `./taskly/app/tasks`, you'll find a set of simple, predefined example tasks.
To create your own tasks, you have two options:
1. **Use the default structure** – Add a config and source file to the `./taskly/app/tasks/configs` and `./taskly/app/tasks/sources` directories, respectively.
2. **Define a custom tasks directory** – Specify your own `tasks` directory elsewhere on your system. This directory must include both a `configs` and `sources` subdirectory, following the same structure as `./taskly/app/tasks`.
If you create a custom `tasks` directory, set the `TASKS_DIR` environment variable before running any commands. For example, run `TASKS_DIR=/path/to/your/tasks/directory pipenv run python cli.py --help`. If `TASKS_DIR` is not set, the predefined tasks in `./taskly/app/tasks` will be used by default.

## CLI
You may use Taskly in CLI mode only, which is not based on Docker:
- Install dependencies:
  - `cd ./taskly/app`
  - `pipenv install`
  - `pipenv run playwright install`
- List all available tasks: `pipenv run python cli.py --help`
- Start single task: `pipenv run python cli.py start_sleep --out /tmp --task-config.seconds 10`
- Start multiple tasks: `pipenv run python cli.py schedule_sleep --out /tmp --scan-config.repeat 5 --task-config.seconds 3`
Note that the CLI mode does not use the messaging queue and neither supports parallel computing nor the MongoDB/MinIO data storage. Instead, all tasks are processed sequentially and all results are stored locally on the file system.

## Run brain and worker on single machine in Docker
- Production (no debugging):
  - Run `cd ./taskly`
  - Run `docker compose --profile production up --build`
  - Optional: Scale workers and assign them to queue
    - Run `QUEUE=default docker compose --profile production up worker --build --scale worker=10`
- Development (with debugging):
  - Run `cd ./taskly`
  - Run `docker compose --profile development up --build --watch`
  - Use the debugger in VSCode to attach to brain or worker

## Setup 2: Run brain and worker on single machine locally
- Install dependencies:
  - `cd ./taskly/app`
  - `pipenv install`
  - `pipenv run playwright install`
- Start services:
  - `cd ./taskly`
  - `docker compose up --build`
- Start brain:
  - `cd ./taskly/app`
  - `PIPENV_DOTENV_LOCATION=../.env.dev pipenv run fastapi dev`
- Start worker:
  - `cd ./taskly/app`
  - `PIPENV_DOTENV_LOCATION=../.env.dev PYTHONPATH=. pipenv run celery -A modules.celery worker -Q default`

## TODO
- Feat: Celery local backend and result store via CLI
- Feat: DB Index
