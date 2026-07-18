#!/usr/bin/env bash
# =============================================================================
# RoofersLabs — production data reset (operator-run, guarded)
# =============================================================================
# Wipes ALL data while preserving schema + migration history. Requires an
# explicit typed confirmation and a DATABASE_URL. NEVER run against a database
# that already has real paying customers. See docs/PRODUCTION_READINESS.md.
#
# Usage:
#   DATABASE_URL=postgresql://… ./infra/scripts/reset-production-data.sh
#   DATABASE_URL=postgresql://… ./infra/scripts/reset-production-data.sh --yes   # skip prompt (CI)
# =============================================================================
set -euo pipefail

DB_URL="${DATABASE_URL:-}"
if [ -z "$DB_URL" ]; then
  echo "error: DATABASE_URL is not set." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "error: psql (postgresql-client) is required." >&2
  exit 1
fi

HERE="$(cd "$(dirname "$0")" && pwd)"
REDACTED="$(printf '%s' "$DB_URL" | sed -E 's#(://[^:/@]+:)[^@]+@#\1***@#')"

echo "This will PERMANENTLY DELETE ALL DATA (schema + migrations preserved) in:"
echo "    $REDACTED"
echo

if [ "${1:-}" != "--yes" ]; then
  read -r -p 'Type "RESET" to continue: ' answer
  if [ "$answer" != "RESET" ]; then
    echo "Aborted."
    exit 1
  fi
fi

psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$HERE/reset-production-data.sql"

echo
echo "Done. Verify emptiness, e.g.:"
echo "  psql \"\$DATABASE_URL\" -c \"SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;\""
echo "Then confirm migrations are intact:"
echo "  psql \"\$DATABASE_URL\" -c \"SELECT migration_name FROM _prisma_migrations ORDER BY finished_at;\""
