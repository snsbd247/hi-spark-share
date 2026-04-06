# Smart ISP — VPS Deployment Guide (v3)

> **Domain:** smartispapp.com | **Server:** 163.245.223.54 | **OS:** Ubuntu 22/24 LTS

---

## 📋 প্রয়োজনীয় জিনিস

- Fresh Ubuntu 22.04/24.04 VPS (Minimum 2GB RAM, 2 vCPU)
- Root SSH Access
- Domain DNS Access
- GitHub Repository URL (Private হলে SSH key লাগবে)

---

## 🚀 Step 1: VPS-এ SSH দিয়ে লগইন

```bash
ssh root@163.245.223.54
```

পাসওয়ার্ড দিয়ে লগইন করুন। প্রথমবার `yes` টাইপ করুন।

---

## 🌐 Step 2: DNS Setup

ডোমেইন রেজিস্ট্রারে এই রেকর্ড যোগ করুন:

| Type | Name | Value |
|------|------|-------|
| A | @ | 163.245.223.54 |
| A | www | 163.245.223.54 |
| A | * | 163.245.223.54 |

> ⚠️ DNS propagation এ ২-৪৮ ঘণ্টা লাগতে পারে।

---

## ⚙️ Step 3: সার্ভার সফটওয়্যার ইনস্টল

এই স্ক্রিপ্ট Nginx, PHP 8.2, MySQL 8, Node.js 20, Composer সব একবারে ইনস্টল করবে:

```bash
wget https://raw.githubusercontent.com/YOUR_ORG/YOUR_REPO/main/ISP-Backend/deploy/vps-setup.sh
chmod +x vps-setup.sh
sudo ./vps-setup.sh
```

> ⚠️ ইনস্টল শেষে DB credentials স্ক্রিনে দেখাবে — **অবশ্যই কপি করে রাখুন!**
> ✅ Credentials অটো সেভ: `/root/.smartisp-credentials`

---

## 📥 Step 4: GitHub থেকে কোড ক্লোন

### 4A: SSH Key সেটআপ (Private Repo হলে)

```bash
ssh-keygen -t ed25519 -C "vps@smartispapp.com"
# Enter চাপুন (default location + no passphrase)

cat ~/.ssh/id_ed25519.pub
# এই পুরো লাইন কপি করুন
```

GitHub > Settings > SSH and GPG keys > New SSH key > কপি করা key পেস্ট করুন।

```bash
ssh -T git@github.com
# 'successfully authenticated' দেখালে ঠিক আছে
```

### 4B: রিপো ক্লোন ও অটো ম্যাপিং

```bash
cd /tmp
git clone git@github.com:YOUR_ORG/YOUR_REPO.git smartisp-repo

cd smartisp-repo
sudo bash vps-clone-setup.sh

rm -rf /tmp/smartisp-repo
```

### ফাইল ম্যাপিং:

| GitHub Source | VPS Destination |
|--------------|-----------------|
| `ISP-Backend/*` | `/var/www/smartisp/backend/` |
| `src/` | `/var/www/smartisp/frontend/src/` |
| `public/` | `/var/www/smartisp/frontend/public/` |
| `package.json` | `/var/www/smartisp/frontend/package.json` |
| `vite.config.ts` | `/var/www/smartisp/frontend/vite.config.ts` |
| `index.html` | `/var/www/smartisp/frontend/index.html` |
| `tailwind.config.ts` | `/var/www/smartisp/frontend/tailwind.config.ts` |
| `tsconfig*.json` | `/var/www/smartisp/frontend/` |

---

## 🔧 Step 5: Laravel Backend কনফিগার

### 5A: .env ফাইল সেটআপ

```bash
cd /var/www/smartisp/backend
cp deploy/env.production .env
nano .env
```

**.env এ পরিবর্তন করুন:**

| Variable | Value |
|----------|-------|
| `APP_URL` | `https://smartispapp.com/api` |
| `FRONTEND_URL` | `https://smartispapp.com` |
| `DB_DATABASE` | `smartisp_db` |
| `DB_USERNAME` | `smartisp_user` |
| `DB_PASSWORD` | Step 3 এ পাওয়া password |
| `SANCTUM_STATEFUL_DOMAINS` | `smartispapp.com,www.smartispapp.com` |
| `SERVER_IP` | `163.245.223.54` |

### 5B: Dependencies ও Database

```bash
php artisan key:generate

composer install --no-dev --optimize-autoloader

php artisan migrate --force
php artisan db:seed --class=DefaultSeeder --force
php artisan db:seed --class=GeoSeeder --force
```

### 5C: Storage ও Permissions

```bash
php artisan storage:link
mkdir -p storage/app/backups/full storage/app/backups/tenants

chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache
```

### 5D: Production Cache

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

---

## 🏗️ Step 6: Frontend বিল্ড

```bash
cd /var/www/smartisp/frontend

npm ci

VITE_DEPLOY_TARGET=vps npm run build

rsync -a --delete dist/ /var/www/smartisp/public_html/

chown -R www-data:www-data /var/www/smartisp/public_html
```

> ⚠️ `VITE_DEPLOY_TARGET=vps` অবশ্যই দিতে হবে! এটা ছাড়া Supabase API ব্যবহার হবে।

---

## 🔄 Step 7: Nginx রিস্টার্ট

```bash
nginx -t
systemctl reload nginx
```

---

## 🔒 Step 8: SSL সার্টিফিকেট

### Option A: Let's Encrypt (ফ্রি — রিকমেন্ডেড)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d smartispapp.com -d www.smartispapp.com

# অটো রিনিউ টেস্ট:
certbot renew --dry-run
```

### Option B: Cloudflare Origin Certificate

1. Cloudflare > SSL/TLS > Origin Server > Create Certificate
2. Certificate ও Key কপি করুন:

```bash
nano /etc/ssl/smartisp/fullchain.pem    # Certificate পেস্ট
nano /etc/ssl/smartisp/privkey.pem       # Private Key পেস্ট
systemctl reload nginx
```

3. Cloudflare SSL mode: **Full (Strict)**

---

## ⏰ Step 9: Cron Job ও Queue Worker

```bash
# Laravel Scheduler
(crontab -l 2>/dev/null; echo "* * * * * cd /var/www/smartisp/backend && php artisan schedule:run >> /dev/null 2>&1") | sort -u | crontab -

# Queue Worker
cp /var/www/smartisp/backend/deploy/smartisp-queue.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable smartisp-queue
systemctl start smartisp-queue
```

---

## ✅ Step 10: ভেরিফিকেশন

```bash
# API Health Check
curl -s https://smartispapp.com/api/api/health | python3 -m json.tool

# Frontend Check
curl -s -o /dev/null -w "%{http_code}" https://smartispapp.com
```

### Default Login:

| Role | Username | Password |
|------|----------|----------|
| Super Admin | admin | admin123 |

> ⚠️ লগইনের পর অবশ্যই পাসওয়ার্ড পরিবর্তন করুন!

---

## 🔄 পরবর্তী আপডেট

### সম্পূর্ণ আপডেট:

```bash
cd /tmp
git clone git@github.com:YOUR_ORG/YOUR_REPO.git smartisp-repo
cd smartisp-repo
sudo bash vps-clone-setup.sh
rm -rf /tmp/smartisp-repo

cd /var/www/smartisp
sudo bash deploy-update.sh
```

### শুধু Backend:

```bash
cd /tmp
git clone git@github.com:YOUR_ORG/YOUR_REPO.git smartisp-repo
rsync -a smartisp-repo/ISP-Backend/ /var/www/smartisp/backend/
rm -rf /tmp/smartisp-repo

cd /var/www/smartisp/backend
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache && php artisan route:cache && php artisan view:cache
systemctl restart php8.2-fpm
```

### শুধু Frontend:

```bash
cd /tmp
git clone git@github.com:YOUR_ORG/YOUR_REPO.git smartisp-repo
rsync -a smartisp-repo/src/ /var/www/smartisp/frontend/src/
cp smartisp-repo/package.json /var/www/smartisp/frontend/
rm -rf /tmp/smartisp-repo

cd /var/www/smartisp/frontend
npm ci && VITE_DEPLOY_TARGET=vps npm run build
rsync -a --delete dist/ /var/www/smartisp/public_html/
chown -R www-data:www-data /var/www/smartisp/public_html
```

---

## 🔧 Troubleshooting

| সমস্যা | সমাধান |
|---------|--------|
| 502 Bad Gateway | `systemctl restart php8.2-fpm` |
| Permission denied | `chown -R www-data:www-data storage bootstrap/cache` |
| API 404 | `php artisan route:cache && nginx -t && systemctl reload nginx` |
| Login error | `.env` তে `SANCTUM_STATEFUL_DOMAINS` চেক |
| Blank page | `VITE_DEPLOY_TARGET=vps` দিয়ে বিল্ড হয়েছে কিনা চেক |
| CORS error | `.env` তে `FRONTEND_URL` চেক |
| npm ci fails | `rm -rf node_modules && npm ci` |

### Logs:

```bash
tail -f /var/log/nginx/smartisp-error.log              # Nginx
tail -f /var/www/smartisp/backend/storage/logs/laravel.log  # Laravel
tail -f /var/log/php/smartisp-error.log                 # PHP-FPM
```

### সার্ভিস রিস্টার্ট:

```bash
systemctl restart php8.2-fpm
systemctl reload nginx
systemctl restart smartisp-queue
```
