#!/bin/sh
# RoofersLabs API container entrypoint.
# Applies pending Prisma migrations before starting the server unless
# MIGRATE_ON_START is explicitly set to "false" (e.g. when a separate release
# step runs migrations).
set -e

if [ "${MIGRATE_ON_START:-true}" = "true" ]; then
  echo "Applying database migrations…"
  npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
fi

exec "$@"
