# Docker'siz o'rnatish: GitHub → server

Kod to'g'ridan-to'g'ri GitHub'dan `git` orqali serverga olinadi va **Node.js + PostgreSQL + Caddy (HTTPS)** bilan ishlaydi. Har safar `main` ga push qilsangiz, GitHub saytni serverda **o'zi yangilaydi**.

Talab: **Ubuntu 22.04/24.04 yoki Debian 12** server, root (yoki sudo) huquqi, 80 va 443 portlar ochiq.

---

## 1. Serverga ulanish (Windows'dan)

PowerShell'ni oching:
```powershell
ssh root@SERVER_IP
```
(birinchi marta `yes` deb yozing, so'ng server parolini kiriting.)

## 2. O'rnatish — bitta buyruq (serverning o'zida)

```bash
curl -fsSL https://raw.githubusercontent.com/Aziimuslim/dokon/main/deploy/native-setup.sh -o setup.sh
sudo bash setup.sh
```
Skript DuckDNS tokenini so'raydi, qolganini o'zi qiladi:

1. Node.js 22, PostgreSQL, Caddy o'rnatadi
2. `dokon` tizim foydalanuvchisini yaratadi, kodni `git clone` bilan `/opt/dokon` ga oladi
3. Bazani yaratadi; parol va 4 ta maxfiy kalitni avtomatik generatsiya qiladi (`/opt/dokon/backend/.env`, faqat `dokon` o'qiy oladi)
4. Frontend'ni build qiladi
5. `dokon` systemd servisini yaratadi (server qayta yuklansa ham sayt o'zi ishga tushadi)
6. DuckDNS'ni server IP'siga yo'naltiradi va har 5 daqiqada yangilab turadi (cron)
7. Caddy orqali HTTPS sertifikatini oladi
8. Tekshiradi: `✅ Tayyor: https://reversdokon.duckdns.org`

Kirgach admin parolini darhol o'zgartiring: `admin@dokon.uz` / `Admin12345` → Profil → Xavfsizlik.

## 3. Yangilash

**Qo'lda** (serverda):
```bash
sudo bash /opt/dokon/deploy/update.sh
```

**Avtomatik — GitHub'dan push qilganda** (bir marta sozlanadi):

1. Serverda deploy uchun SSH kalit yarating:
   ```bash
   ssh-keygen -t ed25519 -N "" -f ~/.ssh/github_deploy
   cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
   cat ~/.ssh/github_deploy
   ```
   Oxirgi buyruq chiqargan **private kalit**ni (`-----BEGIN OPENSSH PRIVATE KEY-----` dan `-----END ...-----` gacha) nusxalang.
2. GitHub → **dokon** repozitoriyasi → **Settings → Secrets and variables → Actions → New repository secret** — uchtasini qo'shing:

   | Nomi | Qiymati |
   |---|---|
   | `SSH_HOST` | server IP manzili |
   | `SSH_USER` | `root` |
   | `SSH_KEY` | 1-qadamdagi private kalit |

3. Tayyor. Endi `main` ga har push'dan keyin GitHub Actions avval testlarni o'tkazadi, o'tsa — serverga ulanib `update.sh` ni yurgizadi. Natijani repozitoriyaning **Actions** bo'limida ko'rasiz.

> Private kalitni hech kimga yubormang va chatga yozmang — faqat GitHub Secrets'ga.

---

## Foydali buyruqlar (serverda)

| Vazifa | Buyruq |
|---|---|
| Sayt holati | `systemctl status dokon` |
| Sayt loglari | `journalctl -u dokon -f` |
| HTTPS (Caddy) loglari | `journalctl -u caddy -n 50` |
| Qayta ishga tushirish | `sudo systemctl restart dokon` |
| DuckDNS'ni qo'lda yangilash | `sudo /usr/local/bin/dokon-duckdns` |
| Baza backup | `sudo -u postgres pg_dump dokon \| gzip > dokon-$(date +%F).sql.gz` |

## Muammolar

| Belgi | Yechim |
|---|---|
| `DuckDNS javobi: KO` | Token noto'g'ri: `sudo rm /etc/dokon-duckdns` va skriptni qayta yurgizing |
| HTTPS sertifikat olinmadi | Hosting panelidagi firewall'da 80 va 443 portlarni oching; `journalctl -u caddy -n 50` |
| 80-port band (nginx/apache) | `sudo systemctl disable --now nginx apache2`, so'ng `sudo systemctl restart caddy` |
| Ilova ishga tushmadi | `journalctl -u dokon -n 50` — xato matnini yuboring |
