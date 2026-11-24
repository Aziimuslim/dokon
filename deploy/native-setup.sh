#!/usr/bin/env bash
# Online do'kon — Docker'siz o'rnatish (Ubuntu/Debian server).
# Kod GitHub'dan git orqali olinadi: Node.js + PostgreSQL + Caddy (HTTPS) + systemd.
#
#   curl -fsSL https://raw.githubusercontent.com/Aziimuslim/dokon/main/deploy/native-setup.sh -o setup.sh
#   sudo bash setup.sh
#
# Qayta yurgizish xavfsiz: .env, baza va ma'lumotlar saqlanadi, kod yangilanadi.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Aziimuslim/dokon.git}"
APP_DIR="${APP_DIR:-/opt/dokon}"
APP_USER="${APP_USER:-dokon}"
DOMAIN="${DOMAIN:-reversdokon.duckdns.org}"
PORT=4000
ENV_FILE="$APP_DIR/backend/.env"
DUCK_FILE="/etc/dokon-duckdns"

green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red() { printf '\033[31m%s\033[0m\n' "$*"; }
step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
as_app() { runuser -u "$APP_USER" -- "$@"; }

[ "$(id -u)" -eq 0 ] || { red "Root huquqi kerak: sudo bash setup.sh"; exit 1; }
command -v apt-get >/dev/null || { red "Bu skript Ubuntu/Debian uchun."; exit 1; }
export DEBIAN_FRONTEND=noninteractive npm_config_update_notifier=false

step "1/8 Tizim paketlari"
apt-get update -qq
apt-get install -y -qq git curl openssl ca-certificates gnupg postgresql >/dev/null
systemctl enable --now postgresql >/dev/null 2>&1 || true

node_major=$(node -v 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/' || echo 0)
if [ "${node_major:-0}" -lt 20 ]; then
  yellow "Node.js 22 o'rnatilmoqda..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
green "Node.js $(node -v), $(psql --version)"

if ! command -v caddy >/dev/null; then
  yellow "Caddy (HTTPS) o'rnatilmoqda..."
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https >/dev/null
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi

step "2/8 Foydalanuvchi va kod ($APP_DIR)"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
if [ -d "$APP_DIR/.git" ]; then
  as_app git -C "$APP_DIR" pull --ff-only
else
  mkdir -p "$APP_DIR" && chown "$APP_USER:$APP_USER" "$APP_DIR"
  as_app git clone --depth 1 "$REPO_URL" "$APP_DIR"
fi

step "3/8 PostgreSQL bazasi"
if [ -f "$ENV_FILE" ]; then
  green "Mavjud $ENV_FILE ishlatiladi."
else
  DB_PASS=$(openssl rand -hex 24)
  if runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='dokon'" | grep -q 1; then
    runuser -u postgres -- psql -qc "ALTER USER dokon WITH PASSWORD '$DB_PASS';"
  else
    runuser -u postgres -- psql -qc "CREATE USER dokon WITH PASSWORD '$DB_PASS';"
  fi
  runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='dokon'" | grep -q 1 \
    || runuser -u postgres -- psql -qc "CREATE DATABASE dokon OWNER dokon;"
  rnd() { openssl rand -hex 32; }
  umask 077
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=$PORT
DATABASE_URL=postgres://dokon:$DB_PASS@localhost:5432/dokon
CLIENT_ORIGIN=https://$DOMAIN
JWT_ACCESS_SECRET=$(rnd)
JWT_REFRESH_SECRET=$(rnd)
ORDER_SIGN_SECRET=$(rnd)
PAYMENT_PROVIDER_SECRET=$(rnd)
SEED_DEMO=true
EOF
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  green "Baza va $ENV_FILE yaratildi (parol va kalitlar avtomatik)."
fi

step "4/8 Build (2–3 daqiqa)"
as_app bash -c "cd '$APP_DIR' && npm --prefix backend ci --omit=dev --no-audit --no-fund >/dev/null && npm --prefix frontend ci --no-audit --no-fund >/dev/null && npm --prefix frontend run build >/dev/null"
green "Frontend build tayyor."

step "5/8 systemd servisi (dokon)"
cat > /etc/systemd/system/dokon.service <<EOF
[Unit]
Description=Online do'kon
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR/backend
EnvironmentFile=$ENV_FILE
ExecStart=$(command -v node) src/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable dokon >/dev/null 2>&1
systemctl restart dokon

step "6/8 DuckDNS"
if [ ! -f "$DUCK_FILE" ]; then
  TOKEN="${DUCKDNS_TOKEN:-}"
  if [ -z "$TOKEN" ]; then
    printf '%s' "DuckDNS token (yozayotganda ekranda ko'rinmaydi): " > /dev/tty
    read -rs TOKEN < /dev/tty; echo > /dev/tty
  fi
  [ -n "$TOKEN" ] || { red "Token kiritilmadi"; exit 1; }
  ( umask 077; printf 'SUB=%s\nTOKEN=%s\n' "${DOMAIN%%.duckdns.org}" "$TOKEN" > "$DUCK_FILE" )
fi
cat > /usr/local/bin/dokon-duckdns <<'EOF'
#!/bin/sh
. /etc/dokon-duckdns
curl -fsS "https://www.duckdns.org/update?domains=${SUB}&token=${TOKEN}&ip="
EOF
chmod 700 /usr/local/bin/dokon-duckdns
echo "*/5 * * * * root /usr/local/bin/dokon-duckdns >/dev/null 2>&1" > /etc/cron.d/dokon-duckdns
RES=$(/usr/local/bin/dokon-duckdns || echo ERR)
if [ "$RES" = "OK" ]; then green "DuckDNS → $(curl -fsS https://api.ipify.org || echo 'server IP')"; else red "DuckDNS javobi: $RES (token noto'g'ri bo'lsa: sudo rm $DUCK_FILE va qayta yurgizing)"; exit 1; fi

step "7/8 HTTPS (Caddy) va firewall"
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
	encode gzip
	reverse_proxy localhost:$PORT
	header Strict-Transport-Security "max-age=31536000"
}
EOF
systemctl enable caddy >/dev/null 2>&1 || true
systemctl restart caddy
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; green "ufw: 80, 443 ochildi"
fi

step "8/8 Tekshiruv"
for _ in $(seq 1 30); do curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1 && break; sleep 2; done
if curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then green "Ilova ishlayapti (localhost:$PORT)"; else red "Ilova ishga tushmadi: journalctl -u dokon -n 50"; exit 1; fi
OK=""
for _ in $(seq 1 24); do
  curl -fsS -o /dev/null --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" 2>/dev/null && { OK=1; break; }
  sleep 5
done
echo
if [ -n "$OK" ]; then
  green "✅ Tayyor: https://$DOMAIN"
  echo "   Admin: admin@dokon.uz / Admin12345 — DARHOL o'zgartiring (Profil → Xavfsizlik)"
else
  yellow "Ilova ishlayapti, lekin HTTPS sertifikat hali olinmadi: journalctl -u caddy -n 30"
  yellow "Odatiy sabab: hosting firewall'ida 80/443 yopiq."
fi
echo
echo "Yangilash:  sudo bash $APP_DIR/deploy/update.sh   (yoki GitHub'ga push — auto-deploy sozlangan bo'lsa)"
echo "Loglar:     journalctl -u dokon -f"
