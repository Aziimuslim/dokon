#!/usr/bin/env bash
# Online do'kon — serverga bir buyruq bilan o'rnatish (Ubuntu/Debian).
#
#   curl -fsSL https://raw.githubusercontent.com/Aziimuslim/dokon/main/deploy/server-setup.sh -o setup.sh
#   sudo bash setup.sh
#
# Qayta ishga tushirsa ham xavfsiz: mavjud .env va ma'lumotlar saqlanadi, kod yangilanadi.
set -euo pipefail

REPO_URL="https://github.com/Aziimuslim/dokon.git"
APP_DIR="${APP_DIR:-/opt/dokon}"
DOMAIN="${DOMAIN:-reversdokon.duckdns.org}"
ENV_FILE="$APP_DIR/deploy/duckdns/.env"
COMPOSE=(docker compose -f "$APP_DIR/deploy/duckdns/docker-compose.yml" --env-file "$ENV_FILE")

green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red() { printf '\033[31m%s\033[0m\n' "$*"; }
step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { red "Root huquqi kerak: sudo bash setup.sh"; exit 1; }
command -v apt-get >/dev/null || { red "Bu skript Ubuntu/Debian uchun. Boshqa tizimda deploy/duckdns/README.md ga qarang."; exit 1; }

step "1/6 Kerakli dasturlar"
apt-get update -qq
apt-get install -y -qq git curl openssl ca-certificates >/dev/null
if ! command -v docker >/dev/null; then
  yellow "Docker o'rnatilmoqda..."
  curl -fsSL https://get.docker.com | sh >/dev/null
fi
systemctl enable --now docker >/dev/null 2>&1 || true
docker compose version >/dev/null || { red "docker compose topilmadi"; exit 1; }
green "Docker: $(docker --version)"

step "2/6 Loyiha kodi ($APP_DIR)"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone --depth 1 "$REPO_URL" "$APP_DIR"
fi

step "3/6 Sozlamalar (.env)"
if [ -f "$ENV_FILE" ]; then
  green "Mavjud $ENV_FILE ishlatiladi (maxfiy kalitlar o'zgarmaydi)."
else
  TOKEN="${DUCKDNS_TOKEN:-}"
  if [ -z "$TOKEN" ]; then
    printf '%s' "DuckDNS token (duckdns.org sahifasidan; yozayotganda ekranda ko'rinmaydi): " > /dev/tty
    read -rs TOKEN < /dev/tty; echo > /dev/tty
  fi
  [ -n "$TOKEN" ] || { red "Token kiritilmadi"; exit 1; }
  rnd() { openssl rand -hex 32; }
  umask 077
  cat > "$ENV_FILE" <<EOF
DOMAIN=$DOMAIN
DUCKDNS_SUBDOMAIN=${DOMAIN%%.duckdns.org}
DUCKDNS_TOKEN=$TOKEN
DB_PASSWORD=$(rnd)
JWT_ACCESS_SECRET=$(rnd)
JWT_REFRESH_SECRET=$(rnd)
ORDER_SIGN_SECRET=$(rnd)
PAYMENT_PROVIDER_SECRET=$(rnd)
EOF
  green "$ENV_FILE yaratildi (maxfiy kalitlar avtomatik generatsiya qilindi)."
fi
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

step "4/6 DuckDNS → shu server IP'si"
RES=$(curl -fsS "https://www.duckdns.org/update?domains=${DUCKDNS_SUBDOMAIN}&token=${DUCKDNS_TOKEN}&ip=" || echo "ERR")
if [ "$RES" = "OK" ]; then green "DuckDNS yangilandi"; else red "DuckDNS javobi: $RES — token yoki subdomen noto'g'ri"; exit 1; fi
PUBLIC_IP=$(curl -fsS https://api.ipify.org || echo "?")
echo "Server IP: $PUBLIC_IP"

step "5/6 Portlar (80, 443)"
for p in 80 443; do
  if ss -ltnp 2>/dev/null | grep -q ":$p " && ! ss -ltnp | grep ":$p " | grep -q docker; then
    red "$p-port band: $(ss -ltnp | grep ":$p " | sed 's/.*users://' | head -1)"
    yellow "Nginx/Apache ishlayotgan bo'lsa to'xtating: sudo systemctl disable --now nginx apache2"
    exit 1
  fi
done
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; green "ufw: 80, 443 ochildi"
fi

step "6/6 Ishga tushirish (birinchi marta 3–5 daqiqa)"
"${COMPOSE[@]}" up -d --build

echo "Sayt ishga tushishini kutyapman..."
for _ in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T app wget -qO- http://localhost:4000/api/health >/dev/null 2>&1; then break; fi
  sleep 5
done
"${COMPOSE[@]}" ps

echo "HTTPS sertifikatini kutyapman..."
OK=""
for _ in $(seq 1 24); do
  if curl -fsS -o /dev/null --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/health" 2>/dev/null; then OK=1; break; fi
  sleep 5
done

echo
if [ -n "$OK" ]; then
  green "✅ Tayyor: https://$DOMAIN"
  echo "   Admin: admin@dokon.uz / Admin12345  — DARHOL o'zgartiring (Profil → Xavfsizlik)"
else
  yellow "Sayt ishga tushdi, lekin HTTPS sertifikat hali olinmadi. Caddy logini ko'ring:"
  echo "   ${COMPOSE[*]} logs caddy | tail -30"
  yellow "Odatiy sabab: hosting/provayder firewall'ida 80 yoki 443 port yopiq."
fi
echo
echo "Foydali buyruqlar:"
echo "   Loglar:     ${COMPOSE[*]} logs -f"
echo "   Yangilash:  sudo bash $APP_DIR/deploy/server-setup.sh"
echo "   To'xtatish: ${COMPOSE[*]} down"
