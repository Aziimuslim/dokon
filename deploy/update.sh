#!/usr/bin/env bash
# Serverdagi saytni GitHub'dagi eng yangi kod bilan yangilash (Docker'siz o'rnatish uchun).
#   sudo bash /opt/dokon/deploy/update.sh
# GitHub Actions auto-deploy ham shu skriptni chaqiradi.
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/dokon}"
APP_USER="${APP_USER:-dokon}"
PORT=4000
export npm_config_update_notifier=false

cd "$APP_DIR"
before=$(runuser -u "$APP_USER" -- git rev-parse HEAD)
runuser -u "$APP_USER" -- git fetch --depth 1 origin main
runuser -u "$APP_USER" -- git reset --hard origin/main
after=$(runuser -u "$APP_USER" -- git rev-parse HEAD)
echo "Kod: ${before:0:7} → ${after:0:7}"

runuser -u "$APP_USER" -- bash -c "cd '$APP_DIR' && npm --prefix backend ci --omit=dev --no-audit --no-fund >/dev/null && npm --prefix frontend ci --no-audit --no-fund >/dev/null && npm --prefix frontend run build >/dev/null"
systemctl restart dokon

for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then echo "✅ Yangilandi va ishlayapti"; exit 0; fi
  sleep 2
done
echo "❌ Ilova ishga tushmadi: journalctl -u dokon -n 50" >&2
exit 1
