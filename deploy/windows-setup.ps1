# Online do'kon — Windows kompyuterda o'rnatish (Docker Desktop + Caddy HTTPS + DuckDNS)
#
# PowerShell'ni ADMINISTRATOR sifatida oching va yurgizing:
#   irm https://raw.githubusercontent.com/Aziimuslim/dokon/main/deploy/windows-setup.ps1 | iex
#
# Qayta yurgizish xavfsiz: mavjud .env va ma'lumotlar saqlanadi, kod yangilanadi.

# 'Continue': PowerShell 5.1 da docker stderr'ga yozgan oddiy xabarlar skriptni to'xtatmasligi uchun.
# Native buyruqlar $LASTEXITCODE bilan, cmdlet'lar -ErrorAction Stop bilan tekshiriladi.
$ErrorActionPreference = 'Continue'
$AppDir = 'C:\dokon'
$Domain = 'reversdokon.duckdns.org'
$Sub = 'reversdokon'
$RepoZip = 'https://github.com/Aziimuslim/dokon/archive/refs/heads/main.zip'

function Step($t) { Write-Host "`n==> $t" -ForegroundColor Cyan }
function Ok($t) { Write-Host $t -ForegroundColor Green }
function Warn($t) { Write-Host $t -ForegroundColor Yellow }
function Fail($t) { Write-Host $t -ForegroundColor Red; throw $t }

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

# ---------------------------------------------------------------- 1. Docker
Step '1/6 Docker Desktop'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Warn 'Docker Desktop o''rnatilmagan.'
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Warn 'O''rnatilmoqda (winget)...'
        winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
    } else {
        Warn 'https://www.docker.com/products/docker-desktop/ dan yuklab o''rnating.'
    }
    Fail 'Docker o''rnatilgach kompyuterni QAYTA YUKLANG, Docker Desktop''ni oching va shu skriptni qayta yurgizing.'
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Warn 'Docker Desktop ishga tushirilmoqda...'
    $dd = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
    if (Test-Path $dd) { Start-Process $dd }
    for ($n = 0; $n -lt 36; $n++) { Start-Sleep 5; docker info *> $null; if ($LASTEXITCODE -eq 0) { break } }
    if ($LASTEXITCODE -ne 0) { Fail 'Docker Desktop ishlamayapti. Uni qo''lda oching (pastki o''ngda kit belgisi yashil bo''lsin) va skriptni qayta yurgizing.' }
}
Ok (docker --version)

# ---------------------------------------------------------------- 2. Kod
Step "2/6 Loyiha kodi ($AppDir)"
$envFile = Join-Path $AppDir 'deploy\duckdns\.env'
$savedEnv = $null
if (Test-Path $envFile) { $savedEnv = [IO.File]::ReadAllText($envFile) }
$tmpZip = Join-Path $env:TEMP 'dokon.zip'
$tmpDir = Join-Path $env:TEMP 'dokon-src'
Invoke-WebRequest -UseBasicParsing $RepoZip -OutFile $tmpZip -ErrorAction Stop
if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force }
Expand-Archive $tmpZip -DestinationPath $tmpDir -Force -ErrorAction Stop
robocopy (Join-Path $tmpDir 'dokon-main') $AppDir /E /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { Fail 'Fayllarni nusxalashda xato.' }
Remove-Item $tmpZip, $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
Ok 'Kod yuklandi.'

# ---------------------------------------------------------------- 3. .env
Step '3/6 Sozlamalar (.env)'
function Rnd { $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object { $_.ToString('x2') }) -join '' }
$utf8NoBom = New-Object Text.UTF8Encoding $false
if ($savedEnv) {
    [IO.File]::WriteAllText($envFile, $savedEnv, $utf8NoBom)
    Ok 'Mavjud .env saqlandi (maxfiy kalitlar o''zgarmaydi).'
} else {
    $sec = Read-Host 'DuckDNS token (duckdns.org sahifasidan)' -AsSecureString
    $token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    if (-not $token) { Fail 'Token kiritilmadi.' }
    $lines = @(
        "DOMAIN=$Domain", "DUCKDNS_SUBDOMAIN=$Sub", "DUCKDNS_TOKEN=$token",
        "DB_PASSWORD=$(Rnd)", "JWT_ACCESS_SECRET=$(Rnd)", "JWT_REFRESH_SECRET=$(Rnd)",
        "ORDER_SIGN_SECRET=$(Rnd)", "PAYMENT_PROVIDER_SECRET=$(Rnd)"
    )
    [IO.File]::WriteAllText($envFile, (($lines -join "`n") + "`n"), $utf8NoBom)
    Ok '.env yaratildi (maxfiy kalitlar avtomatik generatsiya qilindi).'
}
$cfg = @{}
foreach ($l in [IO.File]::ReadAllLines($envFile)) { if ($l -match '^([A-Z_]+)=(.*)$') { $cfg[$Matches[1]] = $Matches[2] } }

# ---------------------------------------------------------------- 4. DuckDNS
Step '4/6 DuckDNS -> shu kompyuterning tashqi IP''si'
$res = (Invoke-WebRequest -UseBasicParsing "https://www.duckdns.org/update?domains=$($cfg.DUCKDNS_SUBDOMAIN)&token=$($cfg.DUCKDNS_TOKEN)&ip=" -ErrorAction Stop).Content
if ($res -ne 'OK') { Fail "DuckDNS javobi: $res - token noto'g'ri. $envFile faylini o'chirib, skriptni qayta yurgizing." }
$ip = (Invoke-WebRequest -UseBasicParsing 'https://api.ipify.org' -ErrorAction SilentlyContinue).Content
Ok "DuckDNS yangilandi. Tashqi IP: $ip"

# ---------------------------------------------------------------- 5. Firewall
Step '5/6 Windows Firewall (80, 443)'
if ($isAdmin) {
    foreach ($p in 80, 443) {
        if (-not (Get-NetFirewallRule -DisplayName "dokon-$p" -ErrorAction SilentlyContinue)) {
            New-NetFirewallRule -DisplayName "dokon-$p" -Direction Inbound -Protocol TCP -LocalPort $p -Action Allow | Out-Null
        }
    }
    Ok 'Firewall: 80 va 443 ochildi.'
} else {
    Warn 'Administrator emas — firewall qoidasi qo''shilmadi. PowerShell''ni "Run as administrator" bilan oching.'
}
foreach ($p in 80, 443) {
    $busy = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
        Where-Object { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName -notmatch 'docker|wslrelay|com.docker' }
    if ($busy) {
        $pn = (Get-Process -Id $busy[0].OwningProcess).ProcessName
        Fail "$p-port band ($pn). IIS/Skype/XAMPP/Apache bo'lsa to'xtating va qayta yurgizing."
    }
}

# ---------------------------------------------------------------- 6. Ishga tushirish
Step '6/6 Ishga tushirish (birinchi marta 5-10 daqiqa)'
$compose = @('compose', '-f', (Join-Path $AppDir 'deploy\duckdns\docker-compose.yml'), '--env-file', $envFile)
& docker @compose up -d --build
if ($LASTEXITCODE -ne 0) { Fail 'docker compose xatosi (yuqoridagi matnga qarang).' }

Write-Host 'Sayt ishga tushishini kutyapman...'
for ($n = 0; $n -lt 60; $n++) {
    & docker @compose exec -T app wget -qO- http://localhost:4000/api/health *> $null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep 5
}
& docker @compose ps

Write-Host 'HTTPS sertifikatini kutyapman...'
$ok = $false
for ($n = 0; $n -lt 24; $n++) {
    & curl.exe -fsS -o NUL --resolve "${Domain}:443:127.0.0.1" "https://$Domain/api/health" 2>$null
    if ($LASTEXITCODE -eq 0) { $ok = $true; break }
    Start-Sleep 5
}

Write-Host ''
if ($ok) {
    Ok "TAYYOR: https://$Domain"
    Write-Host '   Admin: admin@dokon.uz / Admin12345 - DARHOL o''zgartiring (Profil -> Xavfsizlik)'
} else {
    Warn 'Sayt ishga tushdi, lekin HTTPS sertifikat olinmadi. Eng ko''p sabab:'
    Warn '  1) ROUTERDA port forwarding yo''q: 80 va 443 -> shu kompyuterning lokal IP''si (ipconfig -> IPv4)'
    Warn '  2) Provayder 80-portni yopgan yoki "oq IP" yo''q (provayderdan so''rang)'
    Write-Host "   Log: docker $($compose -join ' ') logs caddy --tail 30"
}
Write-Host ''
Write-Host 'Foydali buyruqlar:'
Write-Host "   Loglar:     docker $($compose -join ' ') logs -f"
Write-Host "   To'xtatish: docker $($compose -join ' ') down"
Write-Host '   Yangilash:  shu skriptni qayta yurgizing'
