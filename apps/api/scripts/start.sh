#!/bin/sh
# Single start entry for both Railway services (same uploaded bundle).
#   SERVICE_ROLE=worker  -> job-queue worker (dist/worker.js), serves GET /health on PORT
#   anything else        -> run migrations, optional demo seed (SEED_DEMO=yes), then the API
set -e
if [ "$SERVICE_ROLE" = "worker" ]; then
  exec node dist/worker.js
fi
npx prisma migrate deploy --schema=./prisma/schema.prisma
if [ "$SEED_DEMO" = "yes" ]; then
  SEED_ALLOW_REMOTE=yes node dist/seed.backoffice.js
fi
exec node dist/index.js
