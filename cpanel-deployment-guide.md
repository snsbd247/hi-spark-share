# Smart ISP — cPanel Deployment Guide
# যে কোনো Domain এ কাজ করবে (Domain-Agnostic)

## 📁 cPanel ফোল্ডার স্ট্রাকচার

```
/home/<cpanel-user>/
└── public_html/
    └── <yourdomain.com>/              ← 🔴 Document Root
        ├── api/                        ← Laravel backend
        │   ├── app/
        │   ├── bootstrap/
        │   ├── config/
        │   ├── database/
        │   ├── public/
        │   │   ├── index.php
        │   │   └── .htaccess
        │   ├── routes/
        │   ├── storage/
        │   ├── vendor/                 ← composer install এ তৈরি হবে
        │   ├── .env                    ← Production credentials
        │   ├── .htaccess               ← ⭐ cpanel-htaccess ফাইল
        │   ├── artisan
        │   └── composer.json
        │
        ├── assets/                     ← React build (auto)
        ├── index.html                  ← React SPA
        ├── .htaccess                   ← SPA routing
        └── favicon.ico
```

---

## 🚀 Step-by-Step Setup

### Step 1: Laravel Backend আপলোড

**Option A: cPanel File Manager দিয়ে**
1. Document root এ `api` ফোল্ডার তৈরি করুন
2. `laravel-backend/` এর সব ফাইল `api/` তে আপলোড করুন (vendor/ বাদে)

**Option B: SSH দিয়ে (faster)**
```bash
cd /home/<cpanel-user>
cp -r laravel-backend/* public_html/<yourdomain.com>/api/
```

### Step 2: api/.htaccess তৈরি করুন

`<document-root>/api/.htaccess` ফাইল তৈরি করুন:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^(.*)$ public/$1 [L]
</IfModule>
```

### Step 3: Composer Install

```bash
cd <document-root>/api
composer install --optimize-autoloader --no-dev
```

> SSH না থাকলে: লোকালে `composer install --no-dev` করে vendor/ সহ আপলোড করুন

### Step 4: Environment Setup

```bash
cd <document-root>/api
cp .env.example .env
php artisan key:generate
```

`.env` ফাইল এডিট করুন:

```env
APP_NAME="Smart ISP"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://yourdomain.com/api

FRONTEND_URL=https://yourdomain.com

DB_CONNECTION=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=your_db_name
DB_USERNAME=your_db_user
DB_PASSWORD=your_password

SANCTUM_STATEFUL_DOMAINS=yourdomain.com,www.yourdomain.com
```

> ⚠️ cPanel MySQL Databases থেকে database ও user তৈরি করুন।
> cPanel এ username prefix লাগে, যেমন: `cpaneluser_dbname`

### Step 5: Database Setup

1. **cPanel → MySQL Databases**
   - New Database: `your_db_name`
   - New User: `your_db_user` + password
   - Add User to Database → All Privileges ✓

2. Migration রান করুন:
```bash
cd <document-root>/api
php artisan migrate --seed
```

### Step 6: Storage & Permissions

```bash
cd <document-root>/api
php artisan storage:link
chmod -R 775 storage bootstrap/cache
```

### Step 7: Production Cache

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### Step 8: React Frontend Build ও Upload

**আপনার লোকাল মেশিনে:**
```bash
npm run build
```

`dist/` ফোল্ডারের সব ফাইল document root এ আপলোড করুন:
- `index.html`
- `assets/` ফোল্ডার
- অন্য সব ফাইল

### Step 9: Cron Job

**cPanel → Cron Jobs** → প্রতি মিনিটে:
```
* * * * * cd <document-root>/api && php artisan schedule:run >> /dev/null 2>&1
```

---

## 🔧 Troubleshooting

### 500 Error?
```bash
cd <document-root>/api
chmod -R 775 storage bootstrap/cache
php artisan config:clear
# Debug দেখতে .env তে APP_DEBUG=true করুন, পরে false করুন
```

### CORS Error?
`config/cors.php` চেক করুন — আপনার domain allowed origins এ আছে কিনা।

### Login কাজ করছে না?
- API URL চেক: `https://yourdomain.com/api/api/admin/login`
- `.env` তে `SANCTUM_STATEFUL_DOMAINS=yourdomain.com`

---

## ✅ Final Checklist

- [ ] Document root এর `api/` তে Laravel আপলোড
- [ ] `api/.htaccess` তৈরি (RewriteRule public/)
- [ ] `composer install` সম্পন্ন
- [ ] `.env` তে DB credentials সেট
- [ ] `php artisan key:generate` হয়েছে
- [ ] MySQL database ও user তৈরি
- [ ] `php artisan migrate --seed` সম্পন্ন
- [ ] `php artisan storage:link` হয়েছে
- [ ] Permissions 775 (storage, bootstrap/cache)
- [ ] React `dist/` আপলোড
- [ ] `.htaccess` (SPA routing) আছে
- [ ] Cron job সেটআপ
- [ ] `APP_DEBUG=false`
- [ ] HTTPS কাজ করছে
- [ ] Login test সম্পন্ন
