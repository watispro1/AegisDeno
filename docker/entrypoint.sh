#!/bin/sh
# Fly mounts the aegis_data volume at /data owned by root. Give the unprivileged
# `node` user its data directory, then drop root before starting the bot.
set -e
if [ "$(id -u)" = "0" ]; then
  mkdir -p "${AEGIS_DB_PATH:-/data/aegis-db}"
  chown -R node:node /data
  exec su-exec node "$@"
fi
exec "$@"
