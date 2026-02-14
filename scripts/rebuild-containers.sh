#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

docker compose down
docker system prune -af --volumes
docker compose build --no-cache backend
docker compose build --no-cache frontend
docker compose up
