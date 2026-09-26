#!/bin/sh
set -e
cd /app
npx prisma migrate deploy
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
