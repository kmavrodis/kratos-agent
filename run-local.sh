#!/usr/bin/env bash
# Bootstrap kratos-agent in fully local mode (Azurite + SQLite).
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env.local ]; then
    cp .env.local.example .env.local
    echo "Created .env.local from template."
    echo "Edit .env.local and set COPILOT_GITHUB_TOKEN before continuing."
    exit 1
fi

docker compose --env-file .env.local up --build
