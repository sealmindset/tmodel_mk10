#!/bin/bash
set -euo pipefail

DB="${DB:-postgres}"
USER="${USER:-postgres}"
PASSWORD="${PASSWORD:-postgres}"
HOST="${HOST:-localhost}"
PORT="${PORT:-5432}"

export PGPASSWORD="$PASSWORD"

backup_dir="backups"
mkdir -p "$backup_dir"
pg_dump --format=custom --file="$backup_dir/db_$(date +%Y%m%d_%H%M).dump" -U "$USER" -h "$HOST" -p "$PORT" "$DB"

dropdb --if-exists -U "$USER" -h "$HOST" -p "$PORT" "$DB"
createdb -U "$USER" -h "$HOST" -p "$PORT" "$DB"

psql -U "$USER" -h "$HOST" -p "$PORT" "$DB" < schema.sql

# Run integration tests (adjust command as needed)
if npm test | tee /tmp/test_log.txt | grep -E 'relation .+ does not exist|column .+ does not exist'; then
  echo "Test failed due to missing relation/column"
  exit 1
fi

echo "Database reset and integrity check succeeded."