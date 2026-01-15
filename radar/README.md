# Passkey Radar

A tool for aggregating and analyzing passkey adoption across multiple directories and websites. Provides CLI, API, and web interfaces for tracking passkey support across the web.

## Development Setup

```bash
cp .env.example .env

pip install pipenv
pipenv install
pipenv run dev
```

Web interface: http://localhost:8090 | Admin: http://localhost:8090/admin

## Production Deployment

```bash
cp .env.example .env
# Edit .env for production
```

### Docker Run

```bash
docker run -d \
  --name passkeys-radar \
  -p 8090:8090 \
  --env-file .env \
  -v passkeys-radar-data:/data \
  ghcr.io/rub-nds/passkeys-radar:latest
```

### Docker Compose

```yaml
services:
  passkeys-radar:
    image: ghcr.io/rub-nds/passkeys-radar:latest
    restart: unless-stopped
    env_file: .env
    expose:
      - "8090"
    volumes:
      - passkeys-radar-data:/data
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.passkeys-radar.rule=Host(`YOUR_DOMAIN`)"
      - "traefik.http.routers.passkeys-radar.entrypoints=websecure"
      - "traefik.http.routers.passkeys-radar.tls.certresolver=letsencrypt"
      - "traefik.http.services.passkeys-radar.loadbalancer.server.port=8090"

  traefik:
    image: traefik:v3.2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      - TRAEFIK_PROVIDERS_DOCKER=true
      - TRAEFIK_PROVIDERS_DOCKER_EXPOSEDBYDEFAULT=false
      - TRAEFIK_ENTRYPOINTS_WEB_ADDRESS=:80
      - TRAEFIK_ENTRYPOINTS_WEBSECURE_ADDRESS=:443
      - TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_ACME_EMAIL=YOUR_EMAIL
      - TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_ACME_STORAGE=/letsencrypt/acme.json
      - TRAEFIK_CERTIFICATESRESOLVERS_LETSENCRYPT_ACME_HTTPCHALLENGE_ENTRYPOINT=web
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt-data:/letsencrypt

volumes:
  passkeys-radar-data:
  letsencrypt-data:
```
