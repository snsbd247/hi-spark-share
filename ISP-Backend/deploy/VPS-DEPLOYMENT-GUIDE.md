# Smart ISP — VPS Deployment Guide (v4)

> **Last Updated:** April 2026  
> **Architecture:** React (Frontend) + Laravel (Backend) — Mono-Repo  
> **Server:** Ubuntu 22.04/24.04 LTS

---

## 📋 Prerequisites

| Item | Version |
|------|---------|
| Ubuntu VPS | 22.04+ LTS (Min 2GB RAM, 2 vCPU) |
| PHP | 8.2+ |
| MySQL/MariaDB | 8.0+ / 10.6+ |
| Node.js | 18+ |
| Composer | 2.x |
| Nginx | Latest |
| Git | Latest |
| Domain | Configured DNS (A record → VPS IP) |

---

## 🚀 Step 1: SSH Login ও প্রাথমিক সেটআপ

```bash
ssh root@YOUR_VPS_IP

# System update
apt update && apt upgrade -y

# Essential packages
apt install -y curl wget git unzip software-properties-common
```

---

## 🔧 Step 2: PHP 8.2 ইনস্টল

```bash
add-apt-repository ppa:ondrej/php -y
apt update

apt install -y php8.2-fpm php8.2-cli php8.2-mysql php8.2-mbstring \
    php8.2-xml php8.2-curl php8.2-zip php8.2-gd php8.2-bcmath \
    php8.2-intl php8.2-readline php8.2-tokenizer php8.2-fileinfo

# Verify
php -v
```

---

## 🗄️ Step 3: MySQL ইনস্টল ও ডাটাবেস তৈরি

```bash
apt install -y mysql-server
mysql_secure_installation

# Database ও User তৈরি
mysql -u root -p
```

```sql
CREATE DATABASE isp_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ispuser'@'localhost' IDENTIFIED BY 'YOUR_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON isp_management.* TO 'ispuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## 🌐 Step 4: Nginx ইনস্টল

```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

---

## 📦 Step 5: Node.js ইনস্টল

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify
node -v
npm -v
```

---

## 🎼 Step 6: Composer ইনস্টল

```bash
curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer
composer --version
```

---

## 📁 Step 7: GitHub থেকে কোড ক্লোন

```bash
# SSH Key সেটআপ (private repo হলে)
ssh-keygen -t ed25519 -C "your-email@example.com"
cat ~/.ssh/id_ed25519.pub
# ↑ এই key টি GitHub → Settings → SSH Keys এ যোগ করুন

# Repo ক্লোন
git clone git@github.com:YOUR_ORG/YOUR_REPO.git /tmp/smartisp-repo
cd /tmp/smartisp-repo
```

---

## 🗂️ Step 8: Auto Setup Script রান করুন

```bash
# Clone Setup Script রান (সব ফাইল সঠিক জায়গায় কপি করবে)
sudo bash vps-clone-setup.sh
```

**এই স্ক্রিপ্ট যা করে:**
- `ISP-Backend/` → `/var/www/smartisp/backend/` কপি
- `src/`, `public/`, config files → `/var/www/smartisp/frontend/` কপি
- `/var/www/smartisp/public_html/` তৈরি (Nginx root)
- Nginx config কপি ও সিমলিংক
- Deploy script সেটাপ

---

## ⚙️ Step 9: Backend সেটআপ (Laravel)

```bash
cd /var/www/smartisp/backend

# .env ফাইল তৈরি
cp deploy/env.production .env
nano .env
```

### .env ফাইলে যা পরিবর্তন করবেন:

```env
APP_URL=https://yourdomain.com/api
FRONTEND_URL=https://yourdomain.com

DB_DATABASE=isp_management
DB_USERNAME=ispuser
DB_PASSWORD=YOUR_STRONG_PASSWORD

CENTRAL_DOMAINS=yourdomain.com,www.yourdomain.com
SANCTUM_STATEFUL_DOMAINS=yourdomain.com,www.yourdomain.com

# Super Admin Login Path (নিরাপত্তার জন্য পরিবর্তন করুন)
SUPER_ADMIN_PATH=admin_login162
```

```bash
# App Key generate
php artisan key:generate

# Composer dependencies
composer install --no-dev --optimize-autoloader

# Database migration ও seeding
php artisan migrate --force
php artisan db:seed --class=DefaultSeeder --force
php artisan db:seed --class=GeoSeeder --force

# Module scan (21টি মডিউল রেজিস্টার করবে)
php artisan modules:scan

# Storage link
php artisan storage:link

# Cache optimize
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

---

## 🎨 Step 10: Frontend বিল্ড

```bash
cd /var/www/smartisp/frontend

# Dependencies install
npm ci --legacy-peer-deps

# VPS মোডে build (গুরুত্বপূর্ণ!)
VITE_DEPLOY_TARGET=vps npm run build

# Build output deploy
rsync -a --delete dist/ /var/www/smartisp/public_html/
```

> ⚠️ **গুরুত্বপূর্ণ:** `VITE_DEPLOY_TARGET=vps` ছাড়া বিল্ড করলে Supabase-এ কানেক্ট করবে, Laravel API-তে না।

---

## 🔒 Step 11: PHP-FPM Pool কনফিগার

```bash
nano /etc/php/8.2/fpm/pool.d/smartisp.conf
```

```ini
[smartisp]
user = www-data
group = www-data
listen = /var/run/php/php8.2-fpm-smartisp.sock
listen.owner = www-data
listen.group = www-data
listen.mode = 0660

pm = dynamic
pm.max_children = 20
pm.start_servers = 5
pm.min_spare_servers = 3
pm.max_spare_servers = 10
pm.max_requests = 500

php_admin_value[error_log] = /var/log/php/smartisp-error.log
php_admin_flag[log_errors] = on
php_admin_value[upload_max_filesize] = 50M
php_admin_value[post_max_size] = 50M
php_admin_value[memory_limit] = 256M
```

```bash
mkdir -p /var/log/php
systemctl restart php8.2-fpm
```

---

## 🌍 Step 12: Nginx কনফিগারেশন

```bash
# Config কপি (clone-setup এ হয়ে গেছে, না হলে ম্যানুয়ালি)
cp /var/www/smartisp/backend/deploy/nginx-smartispapp.conf \
   /etc/nginx/sites-available/smartispapp.com
ln -sf /etc/nginx/sites-available/smartispapp.com /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Domain নাম পরিবর্তন করুন (যদি smartispapp.com না হয়)
nano /etc/nginx/sites-available/smartispapp.com

# Test ও reload
nginx -t
systemctl reload nginx
```

---

## 🔐 Step 13: SSL Certificate

### Option A: Cloudflare (Recommended)

1. Cloudflare-এ domain add করুন
2. SSL/TLS → **Full (Strict)** সিলেক্ট করুন
3. Origin Server → **Create Certificate** → PEM key পান

```bash
mkdir -p /etc/ssl/smartisp
nano /etc/ssl/smartisp/fullchain.pem   # Certificate paste
nano /etc/ssl/smartisp/privkey.pem     # Private key paste
chmod 600 /etc/ssl/smartisp/privkey.pem
systemctl reload nginx
```

### Option B: Let's Encrypt (Free)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
certbot renew --dry-run
```

---

## 📂 Step 14: Permissions সেটআপ

```bash
chown -R www-data:www-data /var/www/smartisp
chmod -R 775 /var/www/smartisp/backend/storage
chmod -R 775 /var/www/smartisp/backend/bootstrap/cache
chmod -R u=rwX,go=rX /var/www/smartisp/public_html
```

---

## ✅ Step 15: ভেরিফিকেশন

```bash
# API Health Check
curl -s https://yourdomain.com/api/health
# Expected: {"status":"ok","timestamp":"...","version":"1.0.2"}

# Frontend check
curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com
# Expected: 200
```

### ডিফল্ট লগইন:

| Portal | URL | Credentials |
|--------|-----|-------------|
| **Super Admin** | `https://yourdomain.com/super-admin/login` | `admin` / `admin123` |
| **Admin** | `https://yourdomain.com/admin/login` | `admin` / `admin123` |

---

## 🔄 পরবর্তী আপডেট (One-Click)

```bash
cd /tmp/smartisp-repo
git pull origin main
sudo /var/www/smartisp/deploy-update.sh
```

**deploy-update.sh স্ক্রিপ্ট যা করে:**
1. Maintenance mode ON
2. GitHub থেকে latest code pull
3. Backend ফাইল sync (`.env` ও `storage/` বাদে)
4. Frontend ফাইল sync
5. `composer install` + `php artisan migrate`
6. `npm ci` + `VITE_DEPLOY_TARGET=vps npm run build`
7. Build → `public_html/` deploy
8. Cache, permissions, PHP-FPM restart, Nginx reload
9. Maintenance mode OFF

---

## 🐛 ট্রাবলশুটিং

### 419 Page Expired / CSRF Error
```bash
cd /var/www/smartisp/backend
php artisan optimize:clear
systemctl restart php8.2-fpm
```

### 502 Bad Gateway
```bash
systemctl status php8.2-fpm
ls -la /var/run/php/php8.2-fpm-smartisp.sock
tail -20 /var/log/nginx/smartisp-error.log
```

### Frontend পেজ Blank / 404
```bash
ls /var/www/smartisp/public_html/
# index.html ও assets/ থাকতে হবে
cd /var/www/smartisp/frontend
VITE_DEPLOY_TARGET=vps npm run build
rsync -a --delete dist/ /var/www/smartisp/public_html/
```

### API Route Not Found
```bash
cd /var/www/smartisp/backend
php artisan route:cache
php artisan route:list | grep "your-route"
```

### Database Connection Error
```bash
cd /var/www/smartisp/backend
php artisan tinker
>>> DB::connection()->getPdo();
```

### Permission Denied
```bash
chown -R www-data:www-data /var/www/smartisp/backend/storage
chmod -R 775 /var/www/smartisp/backend/storage /var/www/smartisp/backend/bootstrap/cache
```

---

## 📁 VPS ডিরেক্টরি স্ট্রাকচার

```
/var/www/smartisp/
├── backend/              ← Laravel Backend
│   ├── app/
│   ├── config/
│   ├── database/
│   ├── deploy/
│   │   ├── vps-setup.sh
│   │   ├── deploy-update.sh
│   │   ├── nginx-smartispapp.conf
│   │   ├── env.production
│   │   └── VPS-DEPLOYMENT-GUIDE.md
│   ├── public/
│   ├── routes/
│   ├── storage/
│   ├── .env              ← Production config (git-ignored)
│   └── composer.json
├── frontend/             ← React Source
│   ├── src/
│   ├── public/
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── public_html/          ← Nginx root (build output)
│   ├── index.html
│   └── assets/
└── deploy-update.sh      ← One-click update script

/tmp/smartisp-repo/       ← Git clone (updates এর জন্য)
```

---

## 🔑 গুরুত্বপূর্ণ নোট

1. **`VITE_DEPLOY_TARGET=vps`** — এই env ছাড়া frontend Supabase ব্যবহার করবে
2. **`.env` ফাইল** — কখনো git-এ push করবেন না
3. **`SUPER_ADMIN_PATH`** — প্রোডাকশনে ডিফল্ট path পরিবর্তন করুন
4. **SSL** — HTTPS ছাড়া session token কাজ করবে না
5. **`php artisan storage:link`** — ফাইল আপলোড/ডাউনলোডের জন্য আবশ্যক
6. **`php artisan modules:scan`** — নতুন মডিউল যোগ হলে রান করুন

---

## 📊 সিস্টেম মডিউল তালিকা (21টি)

| # | Module | Slug | Core |
|---|--------|------|------|
| 1 | Dashboard | `dashboard` | ✅ |
| 2 | Customer Management | `customers` | ✅ |
| 3 | Billing | `billing` | ✅ |
| 4 | Payments | `payments` | ✅ |
| 5 | Merchant Payments | `merchant_payments` | ❌ |
| 6 | Support Tickets | `tickets` | ❌ |
| 7 | SMS & Reminders | `sms` | ❌ |
| 8 | Accounting | `accounting` | ❌ |
| 9 | Inventory & Sales | `inventory` | ❌ |
| 10 | Human Resource | `hr` | ❌ |
| 11 | Supplier Management | `supplier` | ❌ |
| 12 | Reports & Analytics | `reports` | ❌ |
| 13 | User Management | `users` | ✅ |
| 14 | Roles & Permissions | `roles` | ✅ |
| 15 | System Settings | `settings` | ✅ |
| 16 | MikroTik | `mikrotik` | ❌ |
| 17 | Packages | `packages` | ✅ |
| 18 | Fiber Network | `fiber_network` | ❌ |
| 19 | Reseller | `reseller` | ❌ |
| 20 | Network Map | `network_map` | ❌ |
| 21 | Live Bandwidth | `live_bandwidth` | ❌ |
