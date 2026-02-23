## CLI Mode

Run tasks locally in CLI mode (without the full taskly infrastructure).

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
