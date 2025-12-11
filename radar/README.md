# The Passkey Radar

A comprehensive tool for aggregating and analyzing passkey adoption across multiple directories and websites. This project provides CLI, API, and web interfaces for tracking passkey support across the web.

## Features

- **Data Aggregation**: Fetches passkey support data from 12 different directories
- **Well-Known Detection**: Tracks websites with `.well-known/webauthn` and `.well-known/passkey-endpoints` files
- **Data Merging**: Intelligently merges and deduplicates entries across sources
- **Web Interface**: Interactive dashboard with charts and data exploration
- **Admin Dashboard**: Protected interface for managing operations
- **RESTful API**: Full API with OpenAPI documentation
- **CLI Support**: Command-line interface for all operations
- **Docker Ready**: Easy deployment with Docker and docker-compose

## Quick Start

### Using Docker (Recommended)

1. Clone the repository
2. Copy the environment file:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` to set your admin password
4. Run with docker-compose:
   ```bash
   docker-compose up -d
   ```
5. Access the web interface at http://localhost:8090
6. Access the admin dashboard at http://localhost:8090/admin (default: admin/changeme)

### Manual Installation

1. Install Python 3.11+
2. Install pipenv:
   ```bash
   pip install pipenv
   ```
3. Install dependencies:
   ```bash
   pipenv install
   ```
4. Run the application:
   ```bash
   pipenv run start
   # or for development with auto-reload
   pipenv run dev
   ```

## Usage

### Web Interface

Navigate to http://localhost:8090 to access:
- **Overview**: Summary statistics and current status
- **Statistics**: Historical charts showing domain growth and directory coverage
- **Data Explorer**: Interactive table with filtering and search capabilities

### Admin Dashboard

Access http://localhost:8090/admin with basic auth credentials to:
- Trigger fetch, combine, and merge operations
- Browse data files
- Monitor system status
- View operation history

### CLI Commands

The tool supports both CLI and API usage with the same functionality:

```bash
# Using pipenv
pipenv run cli fetch
pipenv run cli combine
pipenv run cli merge

# Or activate the virtual environment
pipenv shell
python -m src.main fetch
python -m src.main fetch --directories dashlane --directories enpass
python -m src.main combine
python -m src.main merge
python -m src.main merge --file 2024-01-01-12-00-00
```

### API Endpoints

#### Public Endpoints
- `GET /` - Web interface
- `GET /api/data/combined/{date}` - Get combined data for a date
- `GET /api/data/merged/{date}` - Get merged data (generates if missing)
- `GET /api/statistics/temporal` - Domain count over time
- `GET /api/statistics/directory` - Per-directory statistics

#### Admin Endpoints (requires authentication)
- `POST /api/fetch` - Trigger directory fetches
- `POST /api/combine` - Combine data sources
- `POST /api/merge` - Merge combined files
- `GET /api/admin/status` - System status
- `GET /api/admin/directories` - List available directories
- `GET /api/admin/files/{type}` - Browse data files

#### API Documentation
- Swagger UI: http://localhost:8090/docs
- ReDoc: http://localhost:8090/redoc

## Project Structure

### Code Organization
```
radar/
├── src/                 # All application code
│   ├── api/            # API layer
│   │   ├── auth.py     # Authentication
│   │   ├── models.py   # Pydantic models
│   │   └── routes/     # API endpoints
│   │       ├── admin.py    # Admin endpoints
│   │       ├── data.py     # Data access
│   │       ├── operations.py # Operations
│   │       └── statistics.py # Analytics
│   ├── core/           # Business logic
│   │   ├── fetch.py    # Fetch logic
│   │   ├── combine.py  # Combine logic
│   │   └── merge_data.py # Merge logic
│   ├── directories/    # Directory modules
│   ├── static/         # Web UI assets
│   │   └── js/         # JavaScript files
│   ├── templates/      # HTML templates
│   ├── app.py          # FastAPI app
│   ├── main.py         # CLI entry point
│   ├── merge.py        # Merge algorithm
│   └── helpers.py      # Utility functions
├── data/               # Data directory (gitignored)
├── Pipfile             # Dependencies
├── Dockerfile          # Container definition
├── docker-compose.yml  # Docker orchestration
└── README.md           # This file
```

### Data Structure
```
data/
├── directories/          # Raw data from each directory
│   ├── passkeys.directory/
│   ├── dashlane.com/
│   └── ...
├── wellknown/           # Well-known endpoint data
│   ├── webauthn/
│   └── endpoints/
├── combined/            # Combined snapshots by date
├── merged/              # Deduplicated final data
└── conflicts/           # Merge conflict records
```

### Data Flow
1. **Fetch**: Collects current data from each directory
2. **Combine**: Aligns data by timestamp, matching closest dates
3. **Merge**: Deduplicates entries by domain/name matching

## Configuration

### Environment Variables
- `DATA_DIR`: Data directory path (default: `../data`)
- `ADMIN_USERNAME`: Admin username (default: `admin`)
- `ADMIN_PASSWORD`: Admin password (default: `changeme`)
- `HOST`: Server host (default: `0.0.0.0`)
- `PORT`: Server port (default: `8090`)

### Supported Directories
- Dashlane Passkeys Directory
- Enpass.io
- FIDO Alliance
- Hideez
- Keeper Security
- Passkey Index
- Passkeys.com
- Passkeys.directory
- Passkeys.io
- 2FA Directory (Passkeys)
- 2FA Directory
- 2Stable Passkeys

## Development

### Adding New Directories

1. Create a new module in `src/directories/` folder
2. Implement `get_entries()` function
3. Add to `Directories` enum in `src/directories/__init__.py`

### Running Tests
```bash
pipenv run test
```

### Code Style
```bash
pipenv run lint
pipenv run format
```

### Available Scripts
- `pipenv run dev` - Start development server with auto-reload
- `pipenv run start` - Start production server
- `pipenv run cli` - Run CLI commands
- `pipenv run test` - Run tests
- `pipenv run lint` - Check code style
- `pipenv run format` - Format code

## Deployment

### Production with Traefik

The docker-compose file includes labels for Traefik integration:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.passkey-radar.rule=Host(`radar.passkeys.tools`)"
  - "traefik.http.routers.passkey-radar.entrypoints=websecure"
  - "traefik.http.routers.passkey-radar.tls.certresolver=letsencrypt"
```

### Security Considerations

1. Change default admin credentials
2. Use HTTPS in production
3. Consider rate limiting for API endpoints
4. Regularly backup the data directory

## License

This project is for research purposes. Please respect the terms of service of the directories being aggregated.
