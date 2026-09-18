#!/usr/bin/env bash
# BizHub cron helper. Reads CRON_SECRET from .env.local and hits a cron route.
# Usage: cron.sh <route>   e.g. cron.sh poll-grants | cron.sh digest
set -euo pipefail
ENV=~/bizhub/.env.local
SECRET=$(grep -E '^CRON_SECRET=' "$ENV" | cut -d= -f2-)
BASE="http://localhost:3004/api/cron"
curl -s -m 90 -H "Authorization: Bearer $SECRET" "$BASE/$1" >/dev/null || true
