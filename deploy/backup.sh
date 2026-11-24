#!/usr/bin/env bash
# Kunlik backup (cron): 0 3 * * * /opt/online-dokon/deploy/backup.sh
set -euo pipefail
DIR=${BACKUP_DIR:-/var/backups/dokon}
mkdir -p "$DIR"
pg_dump "${DATABASE_URL:-postgres://dokon@localhost/dokon}" | gzip > "$DIR/dokon-$(date +%F).sql.gz"
find "$DIR" -name 'dokon-*.sql.gz' -mtime +14 -delete
