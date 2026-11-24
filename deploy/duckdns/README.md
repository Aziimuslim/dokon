# reversdokon.duckdns.org — saytni o'z domeningizda ishga tushirish

DuckDNS domeni faqat domen nomini IP manzilga bog'laydi. Sayt shu IP'dagi kompyuterda ishlab turishi kerak. Ikki yo'l bor:

| | A) O'z kompyuteringiz/serveringiz | B) Render + DuckDNS |
|---|---|---|
| Qayerda ishlaydi | Siz tanlagan kompyuter (IP: `37.110.211.134`) | Render bulutida |
| Kompyuter yoqiq turishi kerakmi | Ha, doim | Yo'q |
| Router sozlash | Kerak (80, 443 port) | Kerak emas |
| HTTPS | Caddy avtomatik oladi | Render avtomatik oladi |

---

## ⚡ Serveringiz bo'lsa (Ubuntu/Debian) — bitta buyruq

```bash
curl -fsSL https://raw.githubusercontent.com/Aziimuslim/dokon/main/deploy/server-setup.sh -o setup.sh
sudo bash setup.sh
```
Skript DuckDNS tokenini so'raydi, qolganini o'zi bajaradi: Docker o'rnatadi, kodni `/opt/dokon` ga yuklaydi, maxfiy kalitlarni generatsiya qiladi, DuckDNS'ni server IP'siga yo'naltiradi, 80/443 portlarni ochadi, saytni HTTPS bilan ishga tushiradi. Yangilash uchun shu buyruqni qayta yurgizing — ma'lumotlar saqlanadi.

---

## A) O'z kompyuteringizda (Docker + Caddy + DuckDNS)

### 1. Docker o'rnating
- **Windows/Mac:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) ni o'rnating va ishga tushiring.
- **Ubuntu:** `curl -fsSL https://get.docker.com | sh`

### 2. Loyihani yuklab oling
```bash
git clone https://github.com/Aziimuslim/dokon.git
cd dokon
```

### 3. Sozlamalar faylini to'ldiring
```bash
cp deploy/duckdns/.env.example deploy/duckdns/.env
```
`deploy/duckdns/.env` ni bloknotda oching:
- `DUCKDNS_TOKEN` — duckdns.org sahifasidagi **token**.
- `DB_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ORDER_SIGN_SECRET`, `PAYMENT_PROVIDER_SECRET` — har biriga **turli** uzun tasodifiy satr (32+ belgi). Yaratish: `openssl rand -hex 32` (Linux/Mac) yoki https://www.random.org/strings/

### 4. Routerda portlarni oching (Port Forwarding)
Router admin paneliga kiring (odatda `192.168.0.1` yoki `192.168.1.1`) → **Port Forwarding / Virtual Server**:

| Tashqi port | Ichki IP | Ichki port | Protokol |
|---|---|---|---|
| 80 | kompyuteringizning lokal IP'si (`ipconfig` → IPv4, masalan `192.168.1.10`) | 80 | TCP |
| 443 | o'sha IP | 443 | TCP |

Windows'da ham firewall'da 80 va 443 ga ruxsat bering (Docker Desktop odatda so'raydi).

### 5. Ishga tushiring
```bash
docker compose -f deploy/duckdns/docker-compose.yml --env-file deploy/duckdns/.env up -d --build
```
Birinchi marta 3–5 daqiqa oladi. Keyin **https://reversdokon.duckdns.org** ochiladi.

Holatni tekshirish:
```bash
docker compose -f deploy/duckdns/docker-compose.yml --env-file deploy/duckdns/.env logs -f caddy duckdns app
```
- `duckdns` logida `DuckDNS: OK` — IP yangilandi.
- `caddy` logida `certificate obtained successfully` — HTTPS tayyor.

### 6. Admin parolini o'zgartiring
`admin@dokon.uz` / `Admin12345` bilan kiring → **Profil → Xavfsizlik**.

### Yangilash (GitHub'dagi yangi kod)
```bash
git pull
docker compose -f deploy/duckdns/docker-compose.yml --env-file deploy/duckdns/.env up -d --build
```

### Muammolar
| Belgi | Sabab va yechim |
|---|---|
| Sayt umuman ochilmaydi | Router port forwarding yoki firewall. Telefonning mobil internetidan tekshiring (uy Wi-Fi'dan emas) |
| Caddy logida `timeout during connect` / sertifikat olinmaydi | Provayder 80-portni yopgan bo'lishi mumkin — provayderdan "oq IP" va 80/443 portlarni so'rang yoki B variantdan foydalaning |
| Uy Wi-Fi'dan domen ochilmaydi, mobil internetdan ochiladi | Router "NAT loopback"ni qo'llamaydi — bu normal, tashqaridan ishlaydi |
| `DuckDNS: KO` | Token yoki subdomen noto'g'ri |

---

## B) Render + DuckDNS (kompyuter yoqiq turishi shart emas)

1. Asosiy README'dagi **Deploy to Render** tugmasi orqali saytni Render'ga joylang.
2. Render → `online-dokon` servisi → **Settings → Custom Domains → Add** → `reversdokon.duckdns.org`.
3. Render ko'rsatgan **A record IP** manzilini nusxalang.
4. duckdns.org → `reversdokon` qatoridagi **current ip** maydoniga shu IP'ni yozing → **update ip**.
5. Render'da **Verify** ni bosing. Bir necha daqiqada HTTPS sertifikat chiqadi va sayt https://reversdokon.duckdns.org da ochiladi.

> B variantda A variantdagi `duckdns` konteynerini ishlatmang — u IP'ni yana uy IP'ingizga qaytarib qo'yadi.

---

## Xavfsizlik
- DuckDNS tokeni — domeningizni boshqarish kaliti. Uni hech kimga yubormang, skrinshotlarda yoping. Agar ko'rinib qolgan bo'lsa, duckdns.org'dagi menyu (yuqori o'ngdagi `|||`) orqali tokenni qayta yarating (recreate token) va `.env` dagi qiymatni yangilang.
- `deploy/duckdns/.env` GitHub'ga yuklanmaydi (`.gitignore`).
