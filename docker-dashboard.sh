#!/bin/sh
set -e
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="${DASHBOARD_PORT:-3000}"
if [ -f /app/frontend/server.js ]; then
  exec node /app/frontend/server.js
fi
if [ -f /app/server.js ]; then
  exec node /app/server.js
fi
echo "Next standalone server.js not found" >&2
exit 1
